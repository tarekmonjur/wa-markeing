import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Campaign } from './entities/campaign.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { WaSession } from '../whatsapp/entities/wa-session.entity';
import { ContactsService } from '../contacts/contacts.service';
import { TemplatesService } from '../templates/templates.service';
import { VariableEngineService } from '../templates/variable-engine.service';
import { CampaignStatus, SessionStatus, MessageStatus, Direction } from '../database/enums';
import { CreateCampaignDto, UpdateCampaignDto } from './dto';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepository: Repository<MessageLog>,
    @InjectRepository(WaSession)
    private readonly sessionRepository: Repository<WaSession>,
    @InjectQueue('campaign')
    private readonly campaignQueue: Queue,
    private readonly contactsService: ContactsService,
    private readonly templatesService: TemplatesService,
    private readonly variableEngine: VariableEngineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateCampaignDto): Promise<Campaign> {
    // Verify session exists and belongs to user
    const session = await this.sessionRepository.findOne({
      where: { id: dto.sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Verify template if provided
    if (dto.templateId) {
      await this.templatesService.findById(userId, dto.templateId);
    }

    // Verify group if provided
    if (dto.groupId) {
      await this.contactsService.findGroupById(userId, dto.groupId);
    }

    const campaign = this.campaignRepository.create({
      userId,
      name: dto.name,
      sessionId: dto.sessionId,
      templateId: dto.templateId,
      groupId: dto.groupId,
      status: CampaignStatus.DRAFT,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    });

    const saved = await this.campaignRepository.save(campaign);
    this.logger.log(`Campaign created: ${saved.id} for user ${userId}`);
    return saved;
  }

  async findAll(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Campaign[]; total: number }> {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const [data, total] = await this.campaignRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
      relations: ['template', 'group'],
    });
    return { data, total };
  }

  async findById(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id, userId },
      relations: ['template', 'group', 'session'],
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCampaignDto,
  ): Promise<Campaign> {
    const campaign = await this.findById(userId, id);

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT campaigns can be edited');
    }

    Object.assign(campaign, dto);
    return this.campaignRepository.save(campaign);
  }

  async remove(userId: string, id: string): Promise<void> {
    const campaign = await this.findById(userId, id);

    if (
      campaign.status === CampaignStatus.RUNNING ||
      campaign.status === CampaignStatus.PAUSED ||
      campaign.status === CampaignStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        'Cannot delete a campaign that is running, paused, or scheduled. Cancel it first.',
      );
    }

    await this.campaignRepository.remove(campaign);
    this.logger.log(`Campaign ${id} deleted by user ${userId}`);
  }

  async start(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.findById(userId, id);

    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Cannot start campaign with status ${campaign.status}`,
      );
    }

    // Check session health
    const session = await this.sessionRepository.findOne({
      where: { id: campaign.sessionId },
    });
    if (!session || session.status !== SessionStatus.CONNECTED) {
      throw new BadRequestException(
        'WhatsApp session is not connected. Please scan QR first.',
      );
    }

    if (!campaign.groupId) {
      throw new BadRequestException('Campaign must have a contact group');
    }

    if (!campaign.templateId) {
      throw new BadRequestException('Campaign must have a template');
    }

    // Get contacts from the group (excluding opted-out)
    const contacts = await this.contactsService.getGroupContactsNotOptedOut(
      userId,
      campaign.groupId,
    );

    if (contacts.length === 0) {
      throw new BadRequestException(
        'No eligible contacts in the group (all opted out or empty)',
      );
    }

    const template = await this.templatesService.findById(
      userId,
      campaign.templateId,
    );

    // Create message log entries and enqueue jobs
    for (const contact of contacts) {
      const resolvedBody = this.variableEngine.resolve(template.body, contact);
      const idempotencyKey = `${campaign.id}:${contact.id}`;

      // Create MessageLog entry
      const log = this.messageLogRepository.create({
        userId,
        campaignId: campaign.id,
        contactId: contact.id,
        body: resolvedBody,
        direction: Direction.OUTBOUND,
        status: MessageStatus.PENDING,
      });
      const savedLog = await this.messageLogRepository.save(log);

      // Enqueue BullMQ job
      await this.campaignQueue.add(
        'send-message',
        {
          campaignId: campaign.id,
          contactId: contact.id,
          sessionId: campaign.sessionId,
          messageLogId: savedLog.id,
          phone: contact.phone,
          body: resolvedBody,
          mediaUrl: template.mediaUrl,
          mediaType: template.mediaType,
          idempotencyKey,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
        },
      );
    }

    // Update campaign
    campaign.status = CampaignStatus.RUNNING;
    campaign.startedAt = new Date();
    campaign.totalContacts = contacts.length;
    const saved = await this.campaignRepository.save(campaign);

    this.logger.log(
      `Campaign ${id} started with ${contacts.length} contacts`,
    );

    this.eventEmitter.emit('campaign.started', {
      campaignId: id,
      totalContacts: contacts.length,
    });

    return saved;
  }

  async pause(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.findById(userId, id);

    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new BadRequestException('Only RUNNING campaigns can be paused');
    }

    // Pause the queue processing for this campaign's jobs
    campaign.status = CampaignStatus.PAUSED;
    const saved = await this.campaignRepository.save(campaign);

    this.logger.log(`Campaign ${id} paused`);
    this.eventEmitter.emit('campaign.paused', { campaignId: id });

    return saved;
  }

  async cancel(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.findById(userId, id);

    if (
      campaign.status !== CampaignStatus.RUNNING &&
      campaign.status !== CampaignStatus.PAUSED &&
      campaign.status !== CampaignStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `Cannot cancel campaign with status ${campaign.status}`,
      );
    }

    // Mark remaining PENDING messages as FAILED
    await this.messageLogRepository
      .createQueryBuilder()
      .update(MessageLog)
      .set({ status: MessageStatus.FAILED, failReason: 'CAMPAIGN_CANCELLED' })
      .where('"campaignId" = :campaignId AND status = :status', {
        campaignId: id,
        status: MessageStatus.PENDING,
      })
      .execute();

    campaign.status = CampaignStatus.FAILED;
    campaign.completedAt = new Date();
    const saved = await this.campaignRepository.save(campaign);

    this.logger.log(`Campaign ${id} cancelled`);
    this.eventEmitter.emit('campaign.cancelled', { campaignId: id });

    return saved;
  }

  /**
   * Called by the BullMQ processor after each message send.
   */
  async updateMessageStatus(
    messageLogId: string,
    status: MessageStatus,
    waMessageId?: string,
    failReason?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = { status };

    if (waMessageId) update.waMessageId = waMessageId;
    if (failReason) update.failReason = failReason;
    if (status === MessageStatus.SENT) update.sentAt = new Date();
    if (status === MessageStatus.DELIVERED) update.deliveredAt = new Date();
    if (status === MessageStatus.READ) update.readAt = new Date();

    await this.messageLogRepository.update(messageLogId, update);

    // Get the campaign id and update counters
    const log = await this.messageLogRepository.findOne({
      where: { id: messageLogId },
    });

    if (log?.campaignId) {
      await this.incrementCampaignCounter(log.campaignId, status);
    }
  }

  private async incrementCampaignCounter(
    campaignId: string,
    status: MessageStatus,
  ): Promise<void> {
    const field =
      status === MessageStatus.SENT || status === MessageStatus.DELIVERED
        ? 'sentCount'
        : status === MessageStatus.FAILED
          ? 'failedCount'
          : null;

    if (!field) return;

    await this.campaignRepository
      .createQueryBuilder()
      .update(Campaign)
      .set({ [field]: () => `"${field}" + 1` })
      .where('id = :id', { id: campaignId })
      .execute();

    // Emit progress event for WebSocket
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (campaign) {
      this.eventEmitter.emit('campaign.progress', {
        campaignId,
        sentCount: campaign.sentCount,
        deliveredCount: campaign.deliveredCount,
        failedCount: campaign.failedCount,
        totalContacts: campaign.totalContacts,
        status: campaign.status,
      });

      // Check completion
      const totalProcessed =
        campaign.sentCount + campaign.failedCount;
      if (
        totalProcessed >= campaign.totalContacts &&
        campaign.status === CampaignStatus.RUNNING
      ) {
        campaign.status = CampaignStatus.COMPLETED;
        campaign.completedAt = new Date();
        await this.campaignRepository.save(campaign);

        this.eventEmitter.emit('campaign.completed', { campaignId });
        this.logger.log(`Campaign ${campaignId} completed`);
      }
    }
  }
}
