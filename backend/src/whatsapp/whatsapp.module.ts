import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WaSession } from './entities/wa-session.entity';
import { AccountHealthService } from './account-health.service';
import { DailyStats } from '../analytics/entities/daily-stats.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WaSession, DailyStats])],
  controllers: [WhatsappController],
  providers: [WhatsappService, AccountHealthService],
  exports: [WhatsappService, AccountHealthService],
})
export class WhatsappModule {}
