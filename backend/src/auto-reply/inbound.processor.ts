import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Contact } from '../contacts/entities/contact.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { WaSession } from '../whatsapp/entities/wa-session.entity';
import { AutoReplyService } from '../auto-reply/auto-reply.service';
import { MessageStatus, Direction } from '../database/enums';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface InboundMessagePayload {
  sessionId: string;
  fromJid: string;
  waMessageId: string;
  body: string;
  timestamp: number;
  mediaType?: string;
}

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit', 'বন্ধ'];
const OPT_IN_KEYWORDS = ['start', 'yes', 'শুরু'];

@Processor('inbound-messages')
export class InboundProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundProcessor.name);
  private readonly sessionManagerUrl: string;

  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepository: Repository<MessageLog>,
    @InjectRepository(WaSession)
    private readonly sessionRepository: Repository<WaSession>,
    private readonly autoReplyService: AutoReplyService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    super();
    this.sessionManagerUrl =
      this.configService.get<string>('SESSION_MANAGER_URL') ?? 'http://session-manager:3002';
  }

  async process(job: Job<InboundMessagePayload>): Promise<void> {
    const { sessionId, fromJid, waMessageId, body, timestamp } = job.data;

    // Extract phone number from JID
    const phone = '+' + fromJid.split('@')[0];

    this.logger.debug({ sessionId, phone, waMessageId }, 'Processing inbound message');

    // Find the session to get the userId
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      this.logger.warn({ sessionId }, 'Session not found for inbound message');
      return;
    }

    const userId = session.userId;

    // Find or create contact
    let contact = await this.contactRepository.findOne({
      where: { userId, phone },
    });
    if (!contact) {
      contact = await this.contactRepository.save(
        this.contactRepository.create({ userId, phone }),
      );
    }

    // Save inbound message log
    const messageLog = await this.messageLogRepository.save(
      this.messageLogRepository.create({
        userId,
        contactId: contact.id,
        waMessageId,
        direction: Direction.INBOUND,
        body,
        status: MessageStatus.DELIVERED,
        deliveredAt: new Date(timestamp * 1000),
      }),
    );

    // Emit for real-time inbox updates
    this.eventEmitter.emit('message.inbound', {
      userId,
      contactId: contact.id,
      messageLogId: messageLog.id,
    });

    const textLower = (body ?? '').toLowerCase().trim();

    // Check opt-out keywords
    if (OPT_OUT_KEYWORDS.includes(textLower)) {
      await this.handleOptOut(userId, contact, sessionId, fromJid);
      return;
    }

    // Check opt-in keywords
    if (OPT_IN_KEYWORDS.includes(textLower) && contact.optedOut) {
      await this.handleOptIn(userId, contact, sessionId, fromJid);
      return;
    }

    // Check auto-reply rules
    if (body) {
      const rule = await this.autoReplyService.findMatch(userId, body, sessionId);
      if (rule) {
        await this.sendReply(sessionId, fromJid, rule.replyBody, userId, contact.id);
      }
    }
  }

  private async handleOptOut(
    userId: string,
    contact: Contact,
    sessionId: string,
    toJid: string,
  ): Promise<void> {
    // Mark contact as opted out
    contact.optedOut = true;
    contact.optedOutAt = new Date();
    await this.contactRepository.save(contact);

    // Log the opt-out event
    await this.messageLogRepository.save(
      this.messageLogRepository.create({
        userId,
        contactId: contact.id,
        direction: Direction.OUTBOUND,
        body: 'You have been unsubscribed. Reply START to re-subscribe.',
        status: MessageStatus.SENT,
        sentAt: new Date(),
      }),
    );

    // Send confirmation reply
    await this.sendReply(
      sessionId,
      toJid,
      'You have been unsubscribed. Reply START to re-subscribe.',
      userId,
      contact.id,
    );

    this.logger.log(
      { userId, contactId: contact.id, phone: contact.phone },
      'Contact opted out via inbound STOP keyword',
    );
  }

  private async handleOptIn(
    userId: string,
    contact: Contact,
    sessionId: string,
    toJid: string,
  ): Promise<void> {
    contact.optedOut = false;
    contact.optedOutAt = undefined;
    await this.contactRepository.save(contact);

    await this.sendReply(
      sessionId,
      toJid,
      'Welcome back! You have been re-subscribed.',
      userId,
      contact.id,
    );

    this.logger.log(
      { userId, contactId: contact.id },
      'Contact re-subscribed via START keyword',
    );
  }

  private async sendReply(
    sessionId: string,
    toJid: string,
    body: string,
    userId: string,
    contactId: string,
  ): Promise<void> {
    try {
      const phone = '+' + toJid.split('@')[0];
      const res = await fetch(
        `${this.sessionManagerUrl}/sessions/${sessionId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, body }),
        },
      );

      if (res.ok) {
        const result = await res.json();
        // Log outbound reply
        await this.messageLogRepository.save(
          this.messageLogRepository.create({
            userId,
            contactId,
            waMessageId: result.waMessageId,
            direction: Direction.OUTBOUND,
            body,
            status: MessageStatus.SENT,
            sentAt: new Date(),
          }),
        );
      }
    } catch (err) {
      this.logger.error({ sessionId, toJid, error: (err as Error).message }, 'Failed to send auto-reply');
    }
  }
}
