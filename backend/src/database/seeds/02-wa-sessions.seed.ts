import { DataSource } from 'typeorm';
import { WaSession } from '../../whatsapp/entities/wa-session.entity';
import { User } from '../../users/entities/user.entity';
import { SessionStatus } from '../../database/enums';

export async function seedWaSessions(
  ds: DataSource,
  users: User[],
): Promise<WaSession[]> {
  const repo = ds.getRepository(WaSession);
  const sessions: WaSession[] = [];

  for (const user of users) {
    const existing = await repo.findOne({ where: { userId: user.id } });
    if (existing) {
      sessions.push(existing);
    } else {
      sessions.push(
        await repo.save(
          repo.create({
            userId: user.id,
            status: SessionStatus.CONNECTED,
            phoneNumber: '+880171234' + String(sessions.length + 1).padStart(4, '0'),
            displayName: user.name,
            lastSeenAt: new Date(),
          }),
        ),
      );
    }
  }

  console.log(`  Seeded ${sessions.length} WA sessions`);
  return sessions;
}
