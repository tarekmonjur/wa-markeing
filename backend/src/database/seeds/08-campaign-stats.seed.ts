import { DataSource } from 'typeorm';

export async function seedCampaignStats(
  ds: DataSource,
  campaigns: { id: string; totalContacts: number; sentCount: number; deliveredCount: number; failedCount: number }[],
  userIds: string[],
  sessionIds: string[],
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

  // Seed 30 days of DailyStats for a realistic trend chart
  const dailyRepo = ds.getRepository('daily_stats');
  const today = new Date();
  let dailyCount = 0;

  for (const userId of userIds) {
    const sessionId = sessionIds.length > 0 ? sessionIds[0] : undefined;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Realistic daily variation
      const base = 5 + Math.floor(Math.random() * 15);
      const sent = base;
      const delivered = Math.max(0, sent - Math.floor(Math.random() * 3));
      const read = Math.floor(delivered * (0.5 + Math.random() * 0.35));
      const failed = sent - delivered;

      await dailyRepo.save({
        userId,
        sessionId: sessionId ?? null,
        date: dateStr,
        sentCount: sent,
        deliveredCount: delivered,
        readCount: read,
        failedCount: failed,
      });
      dailyCount++;
    }
  }

  console.log(`  ✅ Seeded ${dailyCount} daily_stats rows (30 days per user)`);
}
