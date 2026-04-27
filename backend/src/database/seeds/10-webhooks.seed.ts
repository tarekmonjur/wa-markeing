import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

export async function seedWebhooks(ds: DataSource, userIds: string[]): Promise<void> {
  const repo = ds.getRepository('webhook_endpoints');

  for (const userId of userIds) {
    await repo.save({
      userId,
      url: 'https://webhook.site/placeholder',
      secret: crypto.randomBytes(32).toString('hex'),
      events: 'campaign.completed,message.sent,message.delivered',
      isActive: true,
    });
  }

  console.log(`  ✅ Seeded webhook_endpoints for ${userIds.length} users`);
}
