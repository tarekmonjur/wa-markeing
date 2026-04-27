import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEndpoint, WebhookDelivery]),
    BullModule.registerQueue({ name: 'webhook' }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookProcessor],
  exports: [WebhooksService],
})
export class WebhooksModule {}
