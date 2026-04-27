import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignProcessor } from './campaign.processor';
import { CampaignLaunchProcessor } from './campaign-launch.processor';
import { SchedulerService } from './scheduler.service';
import { RateLimiterService } from './rate-limiter.service';
import { AbTestService } from './ab-test.service';
import { RecurringCampaignService } from './recurring-campaign.service';
import { Campaign } from './entities/campaign.entity';
import { AbTest } from './entities/ab-test.entity';
import { AbResult } from './entities/ab-result.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { WaSession } from '../whatsapp/entities/wa-session.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ContactsModule } from '../contacts/contacts.module';
import { TemplatesModule } from '../templates/templates.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, AbTest, AbResult, MessageLog, WaSession, Contact]),
    BullModule.registerQueue({ name: 'campaign' }),
    BullModule.registerQueue({ name: 'campaign-launch' }),
    ScheduleModule.forRoot(),
    ContactsModule,
    TemplatesModule,
    AnalyticsModule,
    SettingsModule,
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignProcessor,
    CampaignLaunchProcessor,
    SchedulerService,
    RateLimiterService,
    AbTestService,
    RecurringCampaignService,
  ],
  exports: [CampaignsService, AbTestService],
})
export class CampaignsModule {}
