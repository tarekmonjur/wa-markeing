import { DataSource } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from '../../api-keys/entities/api-key.entity';
import { User } from '../../users/entities/user.entity';

export async function seedApiKeys(
  ds: DataSource,
  users: User[],
): Promise<void> {
  const repo = ds.getRepository(ApiKey);

  // Only PRO/AGENCY users can use API keys
  const proUser = users[0]; // Tarek (PRO)

  const demoKeys = [
    {
      userId: proUser.id,
      name: 'CRM Integration',
      rawKey: `wam_${randomBytes(32).toString('base64url')}`,
    },
    {
      userId: proUser.id,
      name: 'Webhook Automation',
      rawKey: `wam_${randomBytes(32).toString('base64url')}`,
    },
  ];

  for (const data of demoKeys) {
    const keyHash = createHash('sha256').update(data.rawKey).digest('hex');
    const existing = await repo.findOne({ where: { userId: data.userId, name: data.name } });
    if (!existing) {
      await repo.save(
        repo.create({
          userId: data.userId,
          name: data.name,
          keyHash,
          keyPrefix: data.rawKey.substring(0, 12),
        }),
      );
    }
  }

  console.log(`  Seeded ${demoKeys.length} API keys`);
}
