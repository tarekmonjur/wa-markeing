import { DataSource } from 'typeorm';

export async function seedAbTests(ds: DataSource, campaignIds: string[]): Promise<void> {
  if (campaignIds.length === 0) return;

  const abRepo = ds.getRepository('ab_tests');
  const resultRepo = ds.getRepository('ab_results');

  // Create an A/B test for the first campaign: Bengali Eid offer vs English
  const campaignId = campaignIds[0];
  const abTest = await abRepo.save({
    campaignId,
    variantA: 'eid-bengali-offer', // Bengali Eid message
    variantB: 'english-collection', // English collection promo
    splitRatio: 0.5,
    status: 'COMPLETED',
    completedAt: new Date(),
    winnerId: 'eid-bengali-offer',
  });

  // Variant A: better read rate (Bengali Eid)
  await resultRepo.save({
    abTestId: abTest.id,
    variant: 'A',
    sent: 25,
    delivered: 23,
    read: 15, // 65% read rate
    replied: 4,
  });

  // Variant B: lower read rate (English)
  await resultRepo.save({
    abTestId: abTest.id,
    variant: 'B',
    sent: 25,
    delivered: 22,
    read: 10, // 45% read rate
    replied: 2,
  });

  console.log(`  ✅ Seeded ab_tests with Bengali vs English variant`);
}
