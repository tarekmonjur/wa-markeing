import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedUsers } from './01-users.seed';
import { seedWaSessions } from './02-wa-sessions.seed';
import { seedContacts } from './03-contacts.seed';
import { seedTemplates } from './04-templates.seed';
import { seedCampaigns } from './05-campaigns.seed';
import { seedAutoReplies } from './06-auto-replies.seed';
import { seedDripSequences } from './07-drip-sequences.seed';
import { seedCampaignStats } from './08-campaign-stats.seed';
import { seedAbTests } from './09-ab-tests.seed';
import { seedWebhooks } from './10-webhooks.seed';
import { seedPlanUsage } from './11-plan-usage.seed';
import { seedApiKeys } from './12-api-keys.seed';
import { seedDateAutomations } from './13-date-automations.seed';
import { seedUserSettings } from './14-user-settings.seed';

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

    // Phase 3 seeds
    // Fetch campaigns for stats seeding
    const campaignRepo = ds.getRepository('campaigns');
    const allCampaigns = await campaignRepo.find();
    await seedCampaignStats(
      ds,
      allCampaigns.map((c: any) => ({
        id: c.id,
        totalContacts: c.totalContacts,
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        failedCount: c.failedCount,
      })),
    );
    const completedCampaignIds = allCampaigns
      .filter((c: any) => c.status === 'COMPLETED')
      .map((c: any) => c.id);
    await seedAbTests(ds, completedCampaignIds);
    await seedWebhooks(ds, users.map((u) => u.id));

    // Phase 4 seeds
    await seedPlanUsage(ds, users);
    await seedApiKeys(ds, users);
    await seedDateAutomations(ds, users);
    await seedUserSettings(ds, users);

    console.log('✅ Seeding completed successfully');
  } finally {
    await ds.destroy();
  }
}

run().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
