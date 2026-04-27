import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { MessageStatus, Direction } from '../database/enums';

export interface ConversationSummary {
  contactId: string;
  contactName?: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: Date;
  lastDirection: Direction;
  unreadCount: number;
}

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  private readonly sessionManagerUrl: string;

  constructor(
    @InjectRepository(MessageLog)
    private readonly messageLogRepository: Repository<MessageLog>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly configService: ConfigService,
  ) {
    this.sessionManagerUrl =
      this.configService.get<string>('SESSION_MANAGER_URL') ?? 'http://session-manager:3002';
  }

  /**
   * List conversations (last message per contact), sorted by most recent.
   */
  async listConversations(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ data: ConversationSummary[]; total: number }> {
    // Get distinct contacts who have messages
    const query = this.messageLogRepository
      .createQueryBuilder('ml')
      .select('ml."contactId"', 'contactId')
      .addSelect('MAX(ml."createdAt")', 'lastMessageAt')
      .where('ml."userId" = :userId', { userId })
      .andWhere('ml."contactId" IS NOT NULL')
      .groupBy('ml."contactId"')
      .orderBy('"lastMessageAt"', 'DESC')
      .limit(limit)
      .offset(offset);

    const conversations = await query.getRawMany();

    const total = await this.messageLogRepository
      .createQueryBuilder('ml')
      .select('COUNT(DISTINCT ml."contactId")', 'count')
      .where('ml."userId" = :userId', { userId })
      .andWhere('ml."contactId" IS NOT NULL')
      .getRawOne();

    const result: ConversationSummary[] = [];

    for (const conv of conversations) {
      const contact = await this.contactRepository.findOne({
        where: { id: conv.contactId },
      });
      if (!contact) continue;

      // Get the last message
      const lastMsg = await this.messageLogRepository.findOne({
        where: { userId, contactId: conv.contactId },
        order: { createdAt: 'DESC' },
      });

      // Count unread inbound messages (those without a READ status)
      const unreadCount = await this.messageLogRepository.count({
        where: {
          userId,
          contactId: conv.contactId,
          direction: Direction.INBOUND,
          status: MessageStatus.DELIVERED,
        },
      });

      result.push({
        contactId: contact.id,
        contactName: contact.name,
        contactPhone: contact.phone,
        lastMessage: lastMsg?.body ?? '',
        lastMessageAt: lastMsg?.createdAt ?? new Date(),
        lastDirection: lastMsg?.direction ?? Direction.INBOUND,
        unreadCount,
      });
    }

    return { data: result, total: parseInt(total?.count ?? '0', 10) };
  }

  /**
   * Get conversation thread for a contact (cursor-based pagination).
   */
  async getThread(
    userId: string,
    contactId: string,
    cursor?: string,
    limit = 50,
  ): Promise<{ data: MessageLog[]; hasMore: boolean }> {
    const qb = this.messageLogRepository
      .createQueryBuilder('ml')
      .where('ml."userId" = :userId', { userId })
      .andWhere('ml."contactId" = :contactId', { contactId })
      .orderBy('ml."createdAt"', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorMsg = await this.messageLogRepository.findOne({
        where: { id: cursor },
      });
      if (cursorMsg) {
        qb.andWhere('ml."createdAt" < :cursorDate', {
          cursorDate: cursorMsg.createdAt,
        });
      }
    }

    const messages = await qb.getMany();
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    return { data: messages, hasMore };
  }

  /**
   * Send a manual one-off message to a contact.
   */
  async sendMessage(
    userId: string,
    contactId: string,
    sessionId: string,
    body: string,
  ): Promise<MessageLog> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, userId },
    });
    if (!contact) throw new Error('Contact not found');

    // Send via session-manager
    const res = await fetch(
      `${this.sessionManagerUrl}/sessions/${sessionId}/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contact.phone, body }),
      },
    );

    let waMessageId: string | undefined;
    let status = MessageStatus.FAILED;
    let failReason: string | undefined;

    if (res.ok) {
      const result = await res.json();
      waMessageId = result.waMessageId;
      status = MessageStatus.SENT;
    } else {
      const err = await res.json().catch(() => ({ error: 'Send failed' }));
      failReason = err.error;
    }

    // Log the message
    return this.messageLogRepository.save(
      this.messageLogRepository.create({
        userId,
        contactId,
        waMessageId,
        direction: Direction.OUTBOUND,
        body,
        status,
        sentAt: status === MessageStatus.SENT ? new Date() : undefined,
        failReason,
      }),
    );
  }
}
