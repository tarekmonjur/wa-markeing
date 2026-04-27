import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AutoReplyRule } from './entities/auto-reply-rule.entity';
import { AutoReplyService } from './auto-reply.service';
import { AutoReplyController } from './auto-reply.controller';
import { KeywordMatcherService } from './keyword-matcher.service';
import { InboundProcessor } from './inbound.processor';
import { Contact } from '../contacts/entities/contact.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { WaSession } from '../whatsapp/entities/wa-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutoReplyRule, Contact, MessageLog, WaSession]),
    BullModule.registerQueue({ name: 'inbound-messages' }),
  ],
  controllers: [AutoReplyController],
  providers: [AutoReplyService, KeywordMatcherService, InboundProcessor],
  exports: [AutoReplyService, KeywordMatcherService],
})
export class AutoReplyModule {}
