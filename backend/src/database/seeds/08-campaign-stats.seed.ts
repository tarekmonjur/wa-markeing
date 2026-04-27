import { DataSource } from 'typeorm';

export async function seedCampaignStats(
  ds: DataSource,
  campaigns: { id: string; totalContacts: number; sentCount: number; deliveredCount: number; failedCount: number }[],
): Promise<void> {
  const repo = ds.getRepository('campaign_stats');

  for (const c of campaigns) {
    const deliveryRate = c.sentCount > 0 ? c.deliveredCount / c.sentCount : 0;
    const readCount = Math.floor(c.deliveredCount * 0.65);
    const repliedCount = Math.floor(c.deliveredCount * 0.12);
    const readRate = c.deliveredCount > 0 ? readCount / c.deliveredCount : 0;
    const replyRate = c.deliveredCount > 0 ? repliedCount / c.deliveredCount : 0;

    await repo.save({
      campaignId: c.id,
      totalContacts: c.totalContacts,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      readCount,
      failedCount: c.failedCount,
      repliedCount,
      optedOutCount: 0,
      deliveryRate,
      readRate,
      replyRate,
    });
  }

  console.log(`  ✅ Seeded campaign_stats for ${campaigns.length} campaigns`);
}
