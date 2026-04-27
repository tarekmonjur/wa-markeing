import { Worker, Job } from 'bullmq';
import { Logger } from 'pino';
import IORedis from 'ioredis';
import { SessionPool } from './SessionPool';

interface SendMessageJob {
  campaignId: string;
  contactId: string;
  sessionId: string;
  messageLogId: string;
  phone: string;
  body: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  idempotencyKey: string;
}

/**
 * BullMQ worker that consumes 'campaign' queue jobs
 * and sends messages via Baileys instances from the SessionPool.
 */
export class MessageSender {
  private worker: Worker | null = null;
  private readonly connection: IORedis;

  // Anti-ban: minimum 2000ms between sends per session
  private readonly MIN_DELAY_MS = 2000;
  private readonly lastSendTime = new Map<string, number>();

  constructor(
    redisUrl: string,
    private readonly pool: SessionPool,
    private readonly logger: Logger,
  ) {
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }

  async start(): Promise<void> {
    this.worker = new Worker(
      'campaign',
      async (job: Job<SendMessageJob>) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: 1, // One at a time to respect rate limits
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
    });

    this.logger.info('MessageSender worker started');
  }

  private async processJob(job: Job<SendMessageJob>): Promise<void> {
    const data = job.data;

    // Rate limit: enforce minimum delay
    await this.enforceDelay(data.sessionId);

    // Get or connect instance
    let instance = this.pool.get(data.sessionId);
    if (!instance || instance.getState() !== 'CONNECTED') {
      instance = await this.pool.connect(data.sessionId);
      if (instance.getState() !== 'CONNECTED') {
        throw new Error(`Session ${data.sessionId} is not connected`);
      }
    }

    // Build JID
    const jid = data.phone.replace('+', '') + '@s.whatsapp.net';

    // Send message
    let waMessageId: string;
    if (data.mediaUrl && data.mediaType) {
      const result = await instance.sendMedia(
        jid,
        data.mediaUrl,
        data.mediaType.toLowerCase() as 'image' | 'video' | 'audio' | 'document',
        data.body,
      );
      waMessageId = result.id;
    } else {
      const result = await instance.sendText(jid, data.body);
      waMessageId = result.id;
    }

    this.lastSendTime.set(data.sessionId, Date.now());

    this.logger.info(
      { sessionId: data.sessionId, campaignId: data.campaignId, waMessageId },
      'Message sent',
    );
  }

  private async enforceDelay(sessionId: string): Promise<void> {
    const lastSent = this.lastSendTime.get(sessionId) ?? 0;
    const elapsed = Date.now() - lastSent;
    if (elapsed < this.MIN_DELAY_MS) {
      const waitMs = this.MIN_DELAY_MS - elapsed + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  async stop(): Promise<void> {
    await this.worker?.close();
    this.connection.disconnect();
  }
}
