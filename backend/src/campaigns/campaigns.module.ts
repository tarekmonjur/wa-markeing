import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignProcessor } from './campaign.processor';
import { CampaignLaunchProcessor } from './campaign-launch.processor';
import { SchedulerService } from './scheduler.service';
import { RateLimiterService } from './rate-limiter.service';
import { Campaign } from './entities/campaign.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { WaSession } from '../whatsapp/entities/wa-session.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ContactsModule } from '../contacts/contacts.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, MessageLog, WaSession, Contact]),
    BullModule.registerQueue({ name: 'campaign' }),
    BullModule.registerQueue({ name: 'campaign-launch' }),
    ContactsModule,
    TemplatesModule,
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignProcessor,
    CampaignLaunchProcessor,
    SchedulerService,
    RateLimiterService,
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
