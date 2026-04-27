import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignStatus } from '../database/enums';
import { SchedulerService } from './scheduler.service';

/**
 * Runs every minute to check for recurring campaigns that need
 * their next occurrence scheduled.
 */
@Injectable()
export class RecurringCampaignService {
  private readonly logger = new Logger(RecurringCampaignService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly schedulerService: SchedulerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleRecurringCampaigns(): Promise<void> {
    // Find completed campaigns that have a recurrence pattern
    const campaigns = await this.campaignRepository
      .createQueryBuilder('c')
      .where('c.recurrence IS NOT NULL')
      .andWhere('c.status = :status', { status: CampaignStatus.COMPLETED })
      .getMany();

    for (const campaign of campaigns) {
      try {
        await this.scheduleNextOccurrence(campaign);
      } catch (err) {
        this.logger.error(
          `Failed to schedule next occurrence for campaign ${campaign.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async scheduleNextOccurrence(campaign: Campaign): Promise<void> {
    const recurrence = campaign.recurrence;
    if (!recurrence) return;

    // Check end date
    if (recurrence.endDate && new Date(recurrence.endDate) < new Date()) {
      this.logger.debug(`Campaign ${campaign.id} recurring end date passed — skipping`);
      return;
    }

    const baseDate = campaign.completedAt ?? campaign.scheduledAt ?? new Date();
    const next = this.calculateNextDate(baseDate, recurrence);

    if (!next || next <= new Date()) {
      return;
    }

    // Clone campaign as a new DRAFT, then schedule
    const cloned = this.campaignRepository.create({
      userId: campaign.userId,
      name: campaign.name,
      sessionId: campaign.sessionId,
      templateId: campaign.templateId,
      groupId: campaign.groupId,
      status: CampaignStatus.DRAFT,
      recurrence: campaign.recurrence,
    });

    const saved = await this.campaignRepository.save(cloned);

    // Remove recurrence from the old campaign so it doesn't re-trigger
    await this.campaignRepository.update(campaign.id, { recurrence: undefined as any });

    await this.schedulerService.scheduleCampaign(saved.id, next);

    this.logger.log(
      `Recurring campaign ${campaign.id} → cloned ${saved.id}, scheduled at ${next.toISOString()}`,
    );
  }

  private calculateNextDate(
    baseDate: Date,
    recurrence: NonNullable<Campaign['recurrence']>,
  ): Date | null {
    const next = new Date(baseDate);

    switch (recurrence.type) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;

      case 'weekly': {
        const daysOfWeek = recurrence.daysOfWeek ?? [1]; // default Monday
        const currentDay = next.getDay();
        // Find next matching day
        let found = false;
        for (let i = 1; i <= 7; i++) {
          const candidateDay = (currentDay + i) % 7;
          if (daysOfWeek.includes(candidateDay)) {
            next.setDate(next.getDate() + i);
            found = true;
            break;
          }
        }
        if (!found) return null;
        break;
      }

      case 'monthly': {
        const dayOfMonth = recurrence.dayOfMonth ?? 1;
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(dayOfMonth, 28));
        break;
      }

      default:
        return null;
    }

    return next;
  }
}
