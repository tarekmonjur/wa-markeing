import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhooksService } from './webhooks.service';

interface WebhookJobPayload {
  deliveryId: string;
  endpointId: string;
}

@Processor('webhook')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  async process(job: Job<WebhookJobPayload>): Promise<void> {
    await this.webhooksService.deliver(job.data.deliveryId);
  }
}
