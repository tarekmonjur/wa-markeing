import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: 'wa_messages_sent_total',
      help: 'Total number of WhatsApp messages sent',
      labelNames: ['userId', 'sessionId', 'status'],
    }),
    makeHistogramProvider({
      name: 'wa_campaign_duration_seconds',
      help: 'Campaign duration in seconds',
      labelNames: ['campaignId'],
      buckets: [10, 30, 60, 120, 300, 600, 1800, 3600],
    }),
    makeGaugeProvider({
      name: 'wa_queue_depth',
      help: 'Current Bull queue depth',
      labelNames: ['userId'],
    }),
    makeGaugeProvider({
      name: 'wa_session_status',
      help: 'WhatsApp session status',
      labelNames: ['sessionId', 'status'],
    }),
    makeCounterProvider({
      name: 'wa_api_requests_total',
      help: 'Total API requests',
      labelNames: ['method', 'route', 'status_code'],
    }),
    makeCounterProvider({
      name: 'wa_ai_generations_total',
      help: 'Total AI text generations',
      labelNames: ['provider', 'userId'],
    }),
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}
