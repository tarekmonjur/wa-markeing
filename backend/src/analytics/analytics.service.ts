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
}
