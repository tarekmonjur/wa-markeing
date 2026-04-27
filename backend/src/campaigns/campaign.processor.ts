import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly sessionManagerUrl: string;

  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly rateLimiter: RateLimiterService,
    private readonly configService: ConfigService,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepository: Repository<MessageLog>,
  ) {
    super();
    this.sessionManagerUrl =
      this.configService.get<string>('SESSION_MANAGER_URL') ?? 'http://session-manager:3002';
  }

  async process(job: Job<CampaignJobPayload>): Promise<void> {
    const { campaignId, contactId, sessionId, messageLogId, phone, body, mediaUrl, mediaType } =
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
        throw new Error('DAILY_CAP_EXCEEDED');
      }
      if (waitTime > 0) {
        await this.delay(waitTime);
      }

      // 5. Send via session-manager HTTP API
      const sendUrl = `${this.sessionManagerUrl}/sessions/${sessionId}/send`;
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, body, mediaUrl, mediaType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `Session-manager returned ${res.status}`);
      }

      const result = await res.json();
      const waMessageId = result.waMessageId;

      this.rateLimiter.recordSend(sessionId);

      // 6. Update message log
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

      // Only mark as FAILED on final attempt (no more BullMQ retries)
      // to prevent double-counting failedCount
      const maxAttempts = (job.opts?.attempts ?? 3);
      const isLastAttempt = (job.attemptsMade + 1) >= maxAttempts;

      if (isLastAttempt || reason === 'DAILY_CAP_EXCEEDED' || reason === 'OPTED_OUT') {
        await this.campaignsService.updateMessageStatus(
          messageLogId,
          MessageStatus.FAILED,
          undefined,
          reason,
        );
        return; // Don't rethrow — final failure
      }

      // Not the last attempt — let BullMQ retry without marking FAILED
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
