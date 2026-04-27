import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as dns from 'dns';
import * as net from 'net';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDelivery, DeliveryStatus } from './entities/webhook-delivery.entity';
import { IsString, IsArray, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];
}

export class UpdateWebhookDto {
  url?: string;
  events?: string[];
  isActive?: boolean;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  // Retry backoff schedule in ms
  private readonly retryDelays = [
    0,           // attempt 1: immediate
    60_000,      // attempt 2: 1 minute
    300_000,     // attempt 3: 5 minutes
    1_800_000,   // attempt 4: 30 minutes
    7_200_000,   // attempt 5: 2 hours
  ];

  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpointRepo: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
    @InjectQueue('webhook')
    private readonly webhookQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateWebhookDto): Promise<WebhookEndpoint> {
    await this.validateWebhookUrl(dto.url);

    const secret = crypto.randomBytes(32).toString('hex');
    const endpoint = this.endpointRepo.create({
      userId,
      url: dto.url,
      secret,
      events: dto.events,
    });

    return this.endpointRepo.save(endpoint);
  }

  async findAll(userId: string): Promise<WebhookEndpoint[]> {
    return this.endpointRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(userId: string, id: string): Promise<WebhookEndpoint> {
    const ep = await this.endpointRepo.findOne({ where: { id, userId } });
    if (!ep) throw new NotFoundException('Webhook endpoint not found');
    return ep;
  }

  async update(userId: string, id: string, dto: UpdateWebhookDto): Promise<WebhookEndpoint> {
    const ep = await this.findById(userId, id);
    if (dto.url) {
      await this.validateWebhookUrl(dto.url);
      ep.url = dto.url;
    }
    if (dto.events) ep.events = dto.events;
    if (dto.isActive !== undefined) ep.isActive = dto.isActive;
    return this.endpointRepo.save(ep);
  }

  async remove(userId: string, id: string): Promise<void> {
    const ep = await this.findById(userId, id);
    await this.endpointRepo.remove(ep);
  }

  async getDeliveries(userId: string, endpointId: string, limit = 50) {
    await this.findById(userId, endpointId);
    return this.deliveryRepo.find({
      where: { endpointId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Dispatch an event to all matching webhook endpoints.
   */
  @OnEvent('campaign.started')
  @OnEvent('campaign.completed')
  @OnEvent('message.sent')
  @OnEvent('message.delivered')
  @OnEvent('message.failed')
  async onAppEvent(payload: Record<string, unknown> & { __event?: string }): Promise<void> {
    // The event name isn't automatically in the payload; we derive it.
    // NestJS EventEmitter fires with the event string, we rely on known keys.
    const eventName = payload.__event as string | undefined;
    if (!eventName) return;

    const userId = payload.userId as string;
    if (!userId) return;

    const endpoints = await this.endpointRepo.find({
      where: { userId, isActive: true },
    });

    for (const ep of endpoints) {
      if (!ep.events.includes(eventName)) continue;

      const delivery = this.deliveryRepo.create({
        endpointId: ep.id,
        event: eventName,
        payload,
        status: DeliveryStatus.PENDING,
      });
      const saved = await this.deliveryRepo.save(delivery);

      await this.webhookQueue.add('deliver', {
        deliveryId: saved.id,
        endpointId: ep.id,
      });
    }
  }

  async deliver(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['endpoint'],
    });
    if (!delivery || !delivery.endpoint) return;

    const endpoint = delivery.endpoint;
    const bodyStr = JSON.stringify(delivery.payload);

    const signature = crypto
      .createHmac('sha256', endpoint.secret)
      .update(bodyStr)
      .digest('hex');

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WA-Signature': `sha256=${signature}`,
          'X-WA-Event': delivery.event,
          'X-WA-Delivery-Id': deliveryId,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await this.deliveryRepo.update(deliveryId, {
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          responseCode: res.status,
          attemptCount: delivery.attemptCount + 1,
        });
      } else {
        const responseBody = await res.text().catch(() => '');
        await this.scheduleRetry(delivery, res.status, responseBody);
      }
    } catch (err) {
      await this.scheduleRetry(delivery, 0, err instanceof Error ? err.message : 'Unknown error');
    }
  }

  private async scheduleRetry(
    delivery: WebhookDelivery,
    responseCode: number,
    responseBody: string,
  ): Promise<void> {
    const nextAttempt = delivery.attemptCount + 1;

    if (nextAttempt >= 5) {
      await this.deliveryRepo.update(delivery.id, {
        status: DeliveryStatus.ABANDONED,
        responseCode,
        responseBody: responseBody.substring(0, 2000),
        attemptCount: nextAttempt,
      });
      this.logger.warn(`Webhook delivery ${delivery.id} abandoned after 5 attempts`);
      return;
    }

    const delay = this.retryDelays[nextAttempt] ?? 7_200_000;
    const nextRetryAt = new Date(Date.now() + delay);

    await this.deliveryRepo.update(delivery.id, {
      status: DeliveryStatus.FAILED,
      responseCode,
      responseBody: responseBody.substring(0, 2000),
      attemptCount: nextAttempt,
      nextRetryAt,
    });

    await this.webhookQueue.add(
      'deliver',
      { deliveryId: delivery.id, endpointId: delivery.endpointId },
      { delay },
    );
  }

  /**
   * SSRF protection: validate that a webhook URL resolves to a public IP.
   */
  private async validateWebhookUrl(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    // In production, require HTTPS
    if (
      process.env.NODE_ENV === 'production' &&
      parsed.protocol !== 'https:'
    ) {
      throw new BadRequestException('Webhook URL must use HTTPS in production');
    }

    // Resolve hostname and check for private IP
    try {
      const { address } = await dns.promises.lookup(parsed.hostname);
      if (this.isPrivateIp(address)) {
        throw new BadRequestException('Webhook URL must resolve to a public address');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Cannot resolve hostname: ${parsed.hostname}`);
    }
  }

  private isPrivateIp(ip: string): boolean {
    if (net.isIPv6(ip)) {
      return ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc00:');
    }
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254)
    );
  }
}
