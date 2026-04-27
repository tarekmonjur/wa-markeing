import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { CampaignStats } from './entities/campaign-stats.entity';
import { DailyStats } from './entities/daily-stats.entity';

interface MessageEvent {
  campaignId?: string;
  userId: string;
  sessionId?: string;
}

@Injectable()
export class StatsUpdaterService {
  private readonly logger = new Logger(StatsUpdaterService.name);

  constructor(
    @InjectRepository(CampaignStats)
    private readonly statsRepo: Repository<CampaignStats>,
    @InjectRepository(DailyStats)
    private readonly dailyRepo: Repository<DailyStats>,
  ) {}

  @OnEvent('message.sent')
  async onMessageSent(payload: MessageEvent): Promise<void> {
    await this.incrementCampaignStat(payload.campaignId, 'sentCount');
    await this.incrementDailyStat(payload.userId, payload.sessionId, 'sentCount');
  }

  @OnEvent('campaign.started')
  async onCampaignStarted(payload: { campaignId: string; totalContacts: number }): Promise<void> {
    await this.ensureCampaignStats(payload.campaignId, payload.totalContacts);
  }

  @OnEvent('message.delivered')
  async onMessageDelivered(payload: MessageEvent): Promise<void> {
    await this.incrementCampaignStat(payload.campaignId, 'deliveredCount');
    await this.incrementDailyStat(payload.userId, payload.sessionId, 'deliveredCount');
    await this.recalculateRates(payload.campaignId);
  }

  @OnEvent('message.read')
  async onMessageRead(payload: MessageEvent): Promise<void> {
    await this.incrementCampaignStat(payload.campaignId, 'readCount');
    await this.incrementDailyStat(payload.userId, payload.sessionId, 'readCount');
    await this.recalculateRates(payload.campaignId);
  }

  @OnEvent('message.failed')
  async onMessageFailed(payload: MessageEvent): Promise<void> {
    await this.incrementCampaignStat(payload.campaignId, 'failedCount');
    await this.incrementDailyStat(payload.userId, payload.sessionId, 'failedCount');
  }

  @OnEvent('message.replied')
  async onMessageReplied(payload: MessageEvent): Promise<void> {
    await this.incrementCampaignStat(payload.campaignId, 'repliedCount');
    await this.recalculateRates(payload.campaignId);
  }

  @OnEvent('message.opted_out')
  async onOptedOut(payload: MessageEvent): Promise<void> {
    await this.incrementCampaignStat(payload.campaignId, 'optedOutCount');
  }

  async ensureCampaignStats(campaignId: string, totalContacts: number): Promise<void> {
    const existing = await this.statsRepo.findOne({ where: { campaignId } });
    if (!existing) {
      await this.statsRepo.save({ campaignId, totalContacts });
    } else {
      await this.statsRepo.update(campaignId, { totalContacts });
    }
  }

  private async incrementCampaignStat(
    campaignId: string | undefined,
    field: keyof CampaignStats,
  ): Promise<void> {
    if (!campaignId) return;
    try {
      await this.statsRepo
        .createQueryBuilder()
        .update(CampaignStats)
        .set({ [field]: () => `"${String(field)}" + 1` })
        .where('"campaignId" = :id', { id: campaignId })
        .execute();
    } catch (err) {
      this.logger.warn(`Failed to increment campaign stat ${String(field)}: ${err}`);
    }
  }

  private async recalculateRates(campaignId: string | undefined): Promise<void> {
    if (!campaignId) return;
    const stats = await this.statsRepo.findOne({ where: { campaignId } });
    if (!stats) return;

    const deliveryRate = stats.sentCount > 0 ? stats.deliveredCount / stats.sentCount : 0;
    const readRate = stats.deliveredCount > 0 ? stats.readCount / stats.deliveredCount : 0;
    const replyRate = stats.deliveredCount > 0 ? stats.repliedCount / stats.deliveredCount : 0;

    await this.statsRepo.update(campaignId, { deliveryRate, readRate, replyRate });
  }

  private async incrementDailyStat(
    userId: string,
    sessionId: string | undefined,
    field: 'sentCount' | 'deliveredCount' | 'readCount' | 'failedCount',
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    try {
      // Upsert daily stats row
      await this.dailyRepo
        .createQueryBuilder()
        .insert()
        .into(DailyStats)
        .values({ userId, sessionId: sessionId ?? undefined, date: today, [field]: 1 })
        .orUpdate([field], ['userId', 'sessionId', 'date'])
        .setParameter(field, () => `"${field}" + 1`)
        .execute()
        .catch(async () => {
          // Fallback: find or create, then increment
          let row = await this.dailyRepo.findOne({
            where: { userId, sessionId: sessionId ?? undefined, date: today },
          });
          if (!row) {
            row = this.dailyRepo.create({
              userId,
              sessionId: sessionId ?? undefined,
              date: today,
            });
            row = await this.dailyRepo.save(row);
          }
          await this.dailyRepo
            .createQueryBuilder()
            .update(DailyStats)
            .set({ [field]: () => `"${field}" + 1` })
            .where('id = :id', { id: row.id })
            .execute();
        });
    } catch (err) {
      this.logger.warn(`Failed to increment daily stat: ${err}`);
    }
  }
}
