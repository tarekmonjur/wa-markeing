import { DataSource } from 'typeorm';
import { UserSettings } from '../../settings/entities/user-settings.entity';
import { User } from '../../users/entities/user.entity';

export async function seedUserSettings(
  ds: DataSource,
  users: User[],
): Promise<void> {
  const repo = ds.getRepository(UserSettings);

  for (const user of users) {
    const existing = await repo.findOne({ where: { userId: user.id } });
    if (!existing) {
      await repo.save(
        repo.create({
          userId: user.id,
          timezone: 'Asia/Dhaka',
          sendWindowStart: 9,
          sendWindowEnd: 21,
          // BD: Sunday-Thursday work week (Fri/Sat off)
          // 1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat,7=Sun
          sendDaysOfWeek: [7, 1, 2, 3, 4],
          smartSendEnabled: true,
        }),
      );
    }
  }

  console.log(`  Seeded user settings for ${users.length} users`);
}
