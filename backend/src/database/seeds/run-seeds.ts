import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedUsers } from './01-users.seed';
import { seedWaSessions } from './02-wa-sessions.seed';
import { seedContacts } from './03-contacts.seed';
import { seedTemplates } from './04-templates.seed';
import { seedCampaigns } from './05-campaigns.seed';
import { seedAutoReplies } from './06-auto-replies.seed';
import { seedDripSequences } from './07-drip-sequences.seed';

async function run() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is not allowed in production!');
  }

  const ds = AppDataSource;
  await ds.initialize();

  try {
    const users = await seedUsers(ds);
    const sessions = await seedWaSessions(ds, users);
    const { contacts, groups } = await seedContacts(ds, users);
    const templates = await seedTemplates(ds, users);
    await seedCampaigns(ds, users, sessions, groups, templates, contacts);
    await seedAutoReplies(ds, users);
    const templatesList = Array.from(templates.values()).flat();
    const contactsList = Array.from(contacts.values()).flat();
    await seedDripSequences(ds, users, templatesList, contactsList, sessions);
    console.log('✅ Seeding completed successfully');
  } finally {
    await ds.destroy();
  }
}

run().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
