import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/entities/user.entity';
import { Plan } from '../../database/enums';

export async function seedUsers(ds: DataSource): Promise<User[]> {
  const repo = ds.getRepository(User);
  const passwordHash = await bcrypt.hash('Demo@1234', 12);

  const demoUsers = [
    {
      email: 'tarek@sbit.com',
      name: 'Md. Tarek',
      plan: Plan.PRO,
      passwordHash,
      isEmailVerified: true,
    },
    {
      email: 'karim@sylhetfoods.com.bd',
      name: 'Mohammad Karim',
      plan: Plan.STARTER,
      passwordHash,
      isEmailVerified: true,
    },
    {
      email: 'nasrin@ctgretail.com.bd',
      name: 'Nasrin Akter',
      plan: Plan.FREE,
      passwordHash,
      isEmailVerified: true,
    },
  ];

  const users: User[] = [];
  for (const data of demoUsers) {
    const existing = await repo.findOne({ where: { email: data.email } });
    if (existing) {
      users.push(existing);
    } else {
      users.push(await repo.save(repo.create(data)));
    }
  }

  console.log(`  Seeded ${users.length} users`);
  return users;
}
