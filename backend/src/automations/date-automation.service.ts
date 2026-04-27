import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateAutomation } from './entities/date-automation.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { SettingsService } from '../settings/settings.service';
import {
  CreateDateAutomationDto,
  UpdateDateAutomationDto,
} from './dto/date-automation.dto';

@Injectable()
export class DateAutomationService {
  private readonly logger = new Logger(DateAutomationService.name);

  constructor(
    @InjectRepository(DateAutomation)
    private readonly automationRepo: Repository<DateAutomation>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectQueue('campaign')
    private readonly campaignQueue: Queue,
    private readonly settingsService: SettingsService,
  ) {}

  async create(
    userId: string,
    dto: CreateDateAutomationDto,
  ): Promise<DateAutomation> {
    const automation = this.automationRepo.create({ ...dto, userId });
    return this.automationRepo.save(automation);
  }

  async findAll(userId: string): Promise<DateAutomation[]> {
    return this.automationRepo.find({
      where: { userId },
      relations: ['template'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    userId: string,
    id: string,
  ): Promise<DateAutomation> {
    const automation = await this.automationRepo.findOne({
      where: { id, userId },
      relations: ['template'],
    });
    if (!automation) throw new NotFoundException('Date automation not found');
    return automation;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDateAutomationDto,
  ): Promise<DateAutomation> {
    const automation = await this.findOne(userId, id);
    Object.assign(automation, dto);
    return this.automationRepo.save(automation);
  }

  async remove(userId: string, id: string): Promise<void> {
    const automation = await this.findOne(userId, id);
    await this.automationRepo.remove(automation);
  }

  /**
   * Runs daily at midnight UTC. Finds active automations,
   * matches contacts by MM-DD in customFields, and enqueues messages.
   */
  @Cron('0 0 * * *', { timeZone: 'UTC' })
  async dailyAutomationCheck(): Promise<void> {
    this.logger.log('Running daily date automation check');

    const automations = await this.automationRepo.find({
      where: { isActive: true },
      relations: ['template'],
    });

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Handle Feb 29 birthdays on Feb 28 in non-leap years
    const isLeapYear =
      (today.getFullYear() % 4 === 0 &&
        today.getFullYear() % 100 !== 0) ||
      today.getFullYear() % 400 === 0;
    const checkFeb29 = month === 2 && day === 28 && !isLeapYear;

    for (const automation of automations) {
      try {
        await this.processAutomation(automation, month, day, checkFeb29);
      } catch (error) {
        this.logger.error(
          { automationId: automation.id, error: error.message },
          'Failed to process date automation',
        );
      }
    }
  }

  private async processAutomation(
    automation: DateAutomation,
    month: number,
    day: number,
    checkFeb29: boolean,
  ): Promise<void> {
    const fieldName = automation.fieldName;

    // Use parameterized query to safely extract date parts from JSONB
    let qb = this.contactRepo
      .createQueryBuilder('contact')
      .where('contact.userId = :userId', { userId: automation.userId })
      .andWhere('contact.optedOut = false')
      .andWhere(`contact."customFields"->>:fieldName IS NOT NULL`, { fieldName })
      .andWhere(
        `EXTRACT(MONTH FROM (contact."customFields"->>:fieldName)::date) = :month`,
        { fieldName, month },
      )
      .andWhere(
        `EXTRACT(DAY FROM (contact."customFields"->>:fieldName)::date) = :day`,
        { fieldName, day },
      );

    let contacts = await qb.getMany();

    // Also match Feb 29 birthdays when today is Feb 28 in non-leap year
    if (checkFeb29) {
      const feb29Contacts = await this.contactRepo
        .createQueryBuilder('contact')
        .where('contact.userId = :userId', { userId: automation.userId })
        .andWhere('contact.optedOut = false')
        .andWhere(`contact."customFields"->>:fieldName IS NOT NULL`, { fieldName })
        .andWhere(
          `EXTRACT(MONTH FROM (contact."customFields"->>:fieldName)::date) = 2`,
        )
        .andWhere(
          `EXTRACT(DAY FROM (contact."customFields"->>:fieldName)::date) = 29`,
        )
        .getMany();

      contacts = [...contacts, ...feb29Contacts];
    }

    if (contacts.length === 0) return;

    this.logger.log(
      { automationId: automation.id, matchedContacts: contacts.length },
      'Matched contacts for date automation',
    );

    // Calculate delay until sendTime in user's timezone
    const settings = await this.settingsService.getOrCreate(automation.userId);
    const delayMs = this.calculateSendDelay(
      automation.sendTime,
      settings.timezone,
    );

    for (const contact of contacts) {
      // Substitute template variables
      const body = this.substituteVariables(
        automation.template.body,
        contact,
      );

      await this.campaignQueue.add(
        'send-message',
        {
          campaignId: `automation-${automation.id}`,
          contactId: contact.id,
          sessionId: automation.sessionId,
          messageLogId: '',
          phone: contact.phone,
          body,
          mediaUrl: automation.template.mediaUrl || undefined,
          mediaType: automation.template.mediaType || undefined,
          idempotencyKey: `auto-${automation.id}-${contact.id}-${new Date().toISOString().substring(0, 10)}`,
        },
        {
          delay: Math.max(0, delayMs),
          removeOnComplete: { count: 5000 },
          removeOnFail: { count: 1000 },
        },
      );
    }
  }

  private calculateSendDelay(sendTime: string, timezone: string): number {
    const [hours, minutes] = sendTime.split(':').map(Number);
    const now = new Date();
    const userNow = new Date(
      now.toLocaleString('en-US', { timeZone: timezone }),
    );

    const target = new Date(userNow);
    target.setHours(hours, minutes, 0, 0);

    return target.getTime() - userNow.getTime();
  }

  private substituteVariables(body: string, contact: Contact): string {
    let result = body;
    result = result.replace(/\{\{name\}\}/g, contact.name || '');
    result = result.replace(/\{\{phone\}\}/g, contact.phone || '');
    result = result.replace(/\{\{email\}\}/g, contact.email || '');

    // Replace customField vars: {{fieldName}}
    if (contact.customFields) {
      for (const [key, value] of Object.entries(contact.customFields)) {
        result = result.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          String(value ?? ''),
        );
      }
    }

    return result;
  }
}
