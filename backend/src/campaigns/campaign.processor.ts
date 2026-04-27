import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignsService } from './campaigns.service';
import { RateLimiterService } from './rate-limiter.service';
import { Contact } from '../contacts/entities/contact.entity';
import { Campaign } from './entities/campaign.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { MessageStatus, CampaignStatus } from '../database/enums';

export interface CampaignJobPayload {
  campaignId: string;
  contactId: string;
  sessionId: string;
  messageLogId: string;
  phone: string;
  body: string;
  mediaUrl?: string;
  mediaType?: string;
  idempotencyKey: string;
}

@Processor('campaign')
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly rateLimiter: RateLimiterService,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepository: Repository<MessageLog>,
  ) {
    super();
  }

  async process(job: Job<CampaignJobPayload>): Promise<void> {
    const { campaignId, contactId, sessionId, messageLogId, phone, body } =
      job.data;

    try {
      // 1. Check if campaign is still running (may have been paused or cancelled)
      const campaign = await this.campaignRepository.findOne({
        where: { id: campaignId },
      });
      if (!campaign || campaign.status !== CampaignStatus.RUNNING) {
        this.logger.debug(
          `Skipping job for campaign ${campaignId}: status=${campaign?.status}`,
        );
        return;
      }

      // 2. Double check: re-read contact to verify opt-out status
      const contact = await this.contactRepository.findOne({
        where: { id: contactId },
      });
      if (!contact || contact.optedOut) {
        await this.campaignsService.updateMessageStatus(
          messageLogId,
          MessageStatus.FAILED,
          undefined,
          'OPTED_OUT',
        );
        return;
      }

      // 3. Check idempotency — has this message already been sent?
      const existingLog = await this.messageLogRepository.findOne({
        where: { id: messageLogId },
      });
      if (existingLog?.waMessageId) {
        this.logger.debug(
          `Message ${messageLogId} already sent (idempotency check)`,
        );
        return;
      }

      // 4. Rate limit check
      const waitTime = await this.rateLimiter.acquireToken(sessionId);
      if (waitTime === -1) {
        // Daily cap exceeded — re-queue with delay until next day
        throw new Error('DAILY_CAP_EXCEEDED');
      }
      if (waitTime > 0) {
        await this.delay(waitTime);
      }

      // 5. Simulate typing presence (the actual Baileys call would be here)
      // In production, this calls the session-manager service
      await this.delay(1000 + Math.random() * 2000);

      // 6. Send message
      // In production, this sends via the session-manager service:
      // POST /send { sessionId, phone, body, media }
      // For now, simulate a successful send
      const waMessageId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      this.rateLimiter.recordSend(sessionId);

      // 7. Update message log
      await this.campaignsService.updateMessageStatus(
        messageLogId,
        MessageStatus.SENT,
        waMessageId,
      );

      this.logger.debug(
        `Message sent to ${phone} for campaign ${campaignId}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send message to ${phone}: ${reason}`,
      );

      await this.campaignsService.updateMessageStatus(
        messageLogId,
        MessageStatus.FAILED,
        undefined,
        reason,
      );

      if (reason === 'DAILY_CAP_EXCEEDED') {
        // Don't retry — will be re-queued for next day
        return;
      }

      throw error; // Let BullMQ handle retry
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
