import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { StatsUpdaterService } from './stats-updater.service';
import { ExportProcessor } from './export.processor';
import { SignificanceService } from './significance.service';
import { CampaignStats } from './entities/campaign-stats.entity';
import { DailyStats } from './entities/daily-stats.entity';
import { ExportJob } from './entities/export-job.entity';
import { MessageLog } from './entities/message-log.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignStats,
      DailyStats,
      ExportJob,
      MessageLog,
      Campaign,
    ]),
    BullModule.registerQueue({ name: 'export' }),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    StatsUpdaterService,
    ExportProcessor,
    SignificanceService,
  ],
  exports: [AnalyticsService, StatsUpdaterService, SignificanceService],
})
export class AnalyticsModule {}
