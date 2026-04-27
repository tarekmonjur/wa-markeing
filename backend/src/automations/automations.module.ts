import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DateAutomation } from './entities/date-automation.entity';
import { DateAutomationService } from './date-automation.service';
import { DateAutomationController } from './date-automation.controller';
import { Contact } from '../contacts/entities/contact.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DateAutomation, Contact]),
    BullModule.registerQueue({ name: 'campaign' }),
    SettingsModule,
  ],
  controllers: [DateAutomationController],
  providers: [DateAutomationService],
  exports: [DateAutomationService],
})
export class AutomationsModule {}
