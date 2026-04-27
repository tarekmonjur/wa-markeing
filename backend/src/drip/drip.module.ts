import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DripSequence } from './entities/drip-sequence.entity';
import { DripStep } from './entities/drip-step.entity';
import { DripEnrollment } from './entities/drip-enrollment.entity';
import { DripService } from './drip.service';
import { DripController } from './drip.controller';
import { DripProcessor } from './drip.processor';
import { Contact } from '../contacts/entities/contact.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { Template } from '../templates/entities/template.entity';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DripSequence,
      DripStep,
      DripEnrollment,
      Contact,
      MessageLog,
      Template,
    ]),
    BullModule.registerQueue({ name: 'drip' }),
    TemplatesModule,
  ],
  controllers: [DripController],
  providers: [DripService, DripProcessor],
  exports: [DripService],
})
export class DripModule {}
