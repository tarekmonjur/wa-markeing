import { DataSource } from 'typeorm';
import { PlanUsage } from '../../billing/entities/plan-usage.entity';
import { User } from '../../users/entities/user.entity';

export async function seedPlanUsage(
  ds: DataSource,
  users: User[],
): Promise<void> {
  const repo = ds.getRepository(PlanUsage);

  const usageData = [
    {
      // Tarek (PRO) — moderate usage
      userId: users[0].id,
      contactCount: 2400,
      sessionsCount: 3,
      campaignsThisMonth: 8,
      messagesToday: 120,
      aiGenerationsToday: 15,
    },
    {
      // Karim (STARTER) — approaching limits (76%)
      userId: users[1].id,
      contactCount: 3800,
      sessionsCount: 2,
      campaignsThisMonth: 22,
      messagesToday: 380,
      aiGenerationsToday: 20,
    },
    {
      // Nasrin (FREE) — near limit (84%)
      userId: users[2].id,
      contactCount: 420,
      sessionsCount: 1,
      campaignsThisMonth: 4,
      messagesToday: 85,
      aiGenerationsToday: 4,
    },
  ];

  for (const data of usageData) {
    const existing = await repo.findOne({ where: { userId: data.userId } });
    if (!existing) {
      await repo.save(repo.create(data));
    }
  }

  console.log(`  Seeded ${usageData.length} plan usage records`);
}
