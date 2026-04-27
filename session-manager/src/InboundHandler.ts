import { Logger } from 'pino';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

export interface InboundMessagePayload {
  sessionId: string;
  fromJid: string;
  waMessageId: string;
  body: string;
  timestamp: number;
  mediaType?: string;
}

/**
 * Handles inbound messages from Baileys instances.
 * Deduplicates using Redis and forwards to NestJS backend via BullMQ.
 */
export class InboundHandler {
  private readonly redis: Redis;
  private readonly inboundQueue: Queue;
  private readonly DEDUP_TTL = 86400; // 24 hours

  constructor(
    private readonly logger: Logger,
    redisUrl: string,
  ) {
    this.redis = new Redis(redisUrl);
    this.inboundQueue = new Queue('inbound-messages', {
      connection: new Redis(redisUrl),
    });
  }

  /**
   * Process a messages.upsert event from Baileys.
   */
  async handleMessages(
    sessionId: string,
    messages: any[],
  ): Promise<void> {
    for (const msg of messages) {
      // Skip status messages and our own outgoing messages
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const waMessageId = msg.key.id;
      if (!waMessageId) continue;

      // Deduplicate using Redis
      const dedupKey = `dedup:inbound:${waMessageId}`;
      const exists = await this.redis.set(
        dedupKey,
        '1',
        'EX',
        this.DEDUP_TTL,
        'NX',
      );
      if (!exists) {
        this.logger.debug(
          { sessionId, waMessageId },
          'Duplicate inbound message — skipping',
        );
        continue;
      }

      // Extract message text
      const body =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        msg.message.imageMessage?.caption ??
        msg.message.videoMessage?.caption ??
        '';

      const fromJid = msg.key.remoteJid ?? '';

      const payload: InboundMessagePayload = {
        sessionId,
        fromJid,
        waMessageId,
        body,
        timestamp: msg.messageTimestamp as number,
      };

      // Detect media type
      if (msg.message.imageMessage) payload.mediaType = 'IMAGE';
      else if (msg.message.videoMessage) payload.mediaType = 'VIDEO';
      else if (msg.message.audioMessage) payload.mediaType = 'AUDIO';
      else if (msg.message.documentMessage) payload.mediaType = 'DOCUMENT';

      await this.inboundQueue.add('process-inbound', payload, {
        removeOnComplete: { count: 5000 },
        removeOnFail: { count: 1000 },
      });

      this.logger.info(
        { sessionId, fromJid, waMessageId },
        'Inbound message queued',
      );
    }
  }

  async close(): Promise<void> {
    await this.inboundQueue.close();
    this.redis.disconnect();
  }
}
