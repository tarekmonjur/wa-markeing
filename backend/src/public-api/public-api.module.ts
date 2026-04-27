import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { Contact } from '../contacts/entities/contact.entity';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ContactsModule } from '../contacts/contacts.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact]),
    BullModule.registerQueue({ name: 'campaign' }),
    CampaignsModule,
    ContactsModule,
    AnalyticsModule,
  ],
  controllers: [PublicApiController],
  providers: [PublicApiService],
})
export class PublicApiModule {}
