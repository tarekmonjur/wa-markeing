import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CampaignStats } from './entities/campaign-stats.entity';
import { DailyStats } from './entities/daily-stats.entity';
import { ExportJob, ExportFormat, ExportStatus } from './entities/export-job.entity';
import { MessageLog } from './entities/message-log.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(CampaignStats)
    private readonly statsRepo: Repository<CampaignStats>,
    @InjectRepository(DailyStats)
    private readonly dailyRepo: Repository<DailyStats>,
    @InjectRepository(ExportJob)
    private readonly exportRepo: Repository<ExportJob>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepo: Repository<MessageLog>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectQueue('export')
    private readonly exportQueue: Queue,
  ) {}

  async getCampaignStats(userId: string, campaignId: string): Promise<CampaignStats> {
    // Verify ownership
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, userId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let stats = await this.statsRepo.findOne({ where: { campaignId } });
    if (!stats) {
      // Build from campaign counters as fallback
      stats = this.statsRepo.create({
        campaignId,
        totalContacts: campaign.totalContacts,
        sentCount: campaign.sentCount,
        deliveredCount: campaign.deliveredCount,
        failedCount: campaign.failedCount,
      });
    }
    return stats;
  }

  async listCampaignsWithStats(
    userId: string,
    page = 1,
    limit = 20,
    startDate?: string,
    endDate?: string,
    status?: string,
  ) {
    const qb = this.campaignRepo
      .createQueryBuilder('c')
      .leftJoinAndMapOne('c.stats', CampaignStats, 'cs', 'cs."campaignId" = c.id')
      .where('c."userId" = :userId', { userId });

    if (status) qb.andWhere('c.status = :status', { status });
    if (startDate && endDate) {
      qb.andWhere('c."createdAt" BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('c."createdAt"', 'DESC')
      .skip((Math.max(1, page) - 1) * limit)
      .take(Math.min(100, limit))
      .getRawAndEntities();

    return { data: data.entities, total };
  }

  async getOverview(userId: string, days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const dailyStats = await this.dailyRepo.find({
      where: {
        userId,
        date: Between(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
        ),
      },
      order: { date: 'ASC' },
    });

    // Aggregate totals
    const totals = dailyStats.reduce(
      (acc, d) => ({
        sent: acc.sent + d.sentCount,
        delivered: acc.delivered + d.deliveredCount,
        read: acc.read + d.readCount,
        failed: acc.failed + d.failedCount,
      }),
      { sent: 0, delivered: 0, read: 0, failed: 0 },
    );

    return { dailyStats, totals, period: { startDate, endDate, days } };
  }

  async getCampaignContacts(
    userId: string,
    campaignId: string,
    page = 1,
    limit = 50,
  ) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, userId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const [data, total] = await this.messageLogRepo.findAndCount({
      where: { campaignId },
      relations: ['contact'],
      order: { createdAt: 'DESC' },
      skip: (Math.max(1, page) - 1) * limit,
      take: Math.min(200, limit),
    });

    return { data, total };
  }

  async createExportJob(
    userId: string,
    campaignId: string,
    format: ExportFormat,
  ): Promise<ExportJob> {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, userId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const job = this.exportRepo.create({
      userId,
      campaignId,
      format,
      status: ExportStatus.PENDING,
    });
    const saved = await this.exportRepo.save(job);

    await this.exportQueue.add('generate-export', {
      exportJobId: saved.id,
      campaignId,
      format,
      userId,
    });

    return saved;
  }

  async getExportJob(userId: string, jobId: string): Promise<ExportJob> {
    const job = await this.exportRepo.findOne({
      where: { id: jobId, userId },
    });
    if (!job) throw new NotFoundException('Export job not found');
    return job;
  }

  /**
   * Backfill campaign_stats and daily_stats from existing MessageLog data.
   * Call once to populate analytics for campaigns that ran before events were wired.
   */
  async backfillStats(userId: string): Promise<{ campaignsUpdated: number; dailyRows: number }> {
    // 1. Backfill campaign_stats from MessageLog aggregation
    const campaignAgg: Array<{
      campaignId: string;
      total: string;
      sent: string;
      delivered: string;
      read: string;
      failed: string;
      replied: string;
    }> = await this.messageLogRepo
      .createQueryBuilder('ml')
      .select('ml."campaignId"', 'campaignId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN ml.status = 'SENT' OR ml.status = 'DELIVERED' OR ml.status = 'READ' THEN 1 ELSE 0 END)`, 'sent')
      .addSelect(`SUM(CASE WHEN ml.status = 'DELIVERED' OR ml.status = 'READ' THEN 1 ELSE 0 END)`, 'delivered')
      .addSelect(`SUM(CASE WHEN ml.status = 'READ' THEN 1 ELSE 0 END)`, 'read')
      .addSelect(`SUM(CASE WHEN ml.status = 'FAILED' THEN 1 ELSE 0 END)`, 'failed')
      .addSelect('0', 'replied')
      .where('ml."userId" = :userId', { userId })
      .andWhere('ml."campaignId" IS NOT NULL')
      .groupBy('ml."campaignId"')
      .getRawMany();

    let campaignsUpdated = 0;
    for (const row of campaignAgg) {
      const sent = parseInt(row.sent, 10) || 0;
      const delivered = parseInt(row.delivered, 10) || 0;
      const read = parseInt(row.read, 10) || 0;
      const failed = parseInt(row.failed, 10) || 0;

      await this.statsRepo.upsert(
        {
          campaignId: row.campaignId,
          totalContacts: parseInt(row.total, 10) || 0,
          sentCount: sent,
          deliveredCount: delivered,
          readCount: read,
          failedCount: failed,
          repliedCount: 0,
          optedOutCount: 0,
          deliveryRate: sent > 0 ? delivered / sent : 0,
          readRate: delivered > 0 ? read / delivered : 0,
          replyRate: 0,
        },
        ['campaignId'],
      );
      campaignsUpdated++;
    }

    // 2. Backfill daily_stats from MessageLog aggregation
    const dailyAgg: Array<{
      userId: string;
      sessionId: string | null;
      date: string;
      sent: string;
      delivered: string;
      read: string;
      failed: string;
    }> = await this.messageLogRepo
      .createQueryBuilder('ml')
      .select('ml."userId"', 'userId')
      .addSelect('ml."sessionId"', 'sessionId')
      .addSelect(`TO_CHAR(ml."createdAt", 'YYYY-MM-DD')`, 'date')
      .addSelect(`SUM(CASE WHEN ml.status IN ('SENT','DELIVERED','READ') THEN 1 ELSE 0 END)`, 'sent')
      .addSelect(`SUM(CASE WHEN ml.status IN ('DELIVERED','READ') THEN 1 ELSE 0 END)`, 'delivered')
      .addSelect(`SUM(CASE WHEN ml.status = 'READ' THEN 1 ELSE 0 END)`, 'read')
      .addSelect(`SUM(CASE WHEN ml.status = 'FAILED' THEN 1 ELSE 0 END)`, 'failed')
      .where('ml."userId" = :userId', { userId })
      .groupBy('ml."userId"')
      .addGroupBy('ml."sessionId"')
      .addGroupBy(`TO_CHAR(ml."createdAt", 'YYYY-MM-DD')`)
      .getRawMany();

    let dailyRows = 0;
    for (const row of dailyAgg) {
      await this.dailyRepo.upsert(
        {
          userId: row.userId,
          sessionId: row.sessionId ?? undefined,
          date: row.date,
          sentCount: parseInt(row.sent, 10) || 0,
          deliveredCount: parseInt(row.delivered, 10) || 0,
          readCount: parseInt(row.read, 10) || 0,
          failedCount: parseInt(row.failed, 10) || 0,
        },
        ['userId', 'sessionId', 'date'],
      );
      dailyRows++;
    }

    this.logger.log(`Backfill complete: ${campaignsUpdated} campaigns, ${dailyRows} daily rows`);
    return { campaignsUpdated, dailyRows };
  }
}
