import { DataSource } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { MessageLog } from '../../analytics/entities/message-log.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { ContactGroup } from '../../contacts/entities/contact-group.entity';
import { Template } from '../../templates/entities/template.entity';
import { WaSession } from '../../whatsapp/entities/wa-session.entity';
import { User } from '../../users/entities/user.entity';
import {
  CampaignStatus,
  MessageStatus,
  Direction,
} from '../../database/enums';

export async function seedCampaigns(
  ds: DataSource,
  users: User[],
  sessions: WaSession[],
  groups: Map<string, ContactGroup>,
  templates: Map<string, Template[]>,
  contacts: Map<string, Contact[]>,
): Promise<void> {
  const campaignRepo = ds.getRepository(Campaign);
  const messageRepo = ds.getRepository(MessageLog);

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const session = sessions[i];
    const group = groups.get(user.id)!;
    const userTemplates = templates.get(user.id)!;
    const userContacts = contacts.get(user.id)!;

    // 1. COMPLETED campaign
    const completed = await campaignRepo.save(
      campaignRepo.create({
        userId: user.id,
        sessionId: session.id,
        groupId: group.id,
        templateId: userTemplates[0].id,
        name: 'Eid Offer 2025',
        status: CampaignStatus.COMPLETED,
        totalContacts: 50,
        sentCount: 50,
        deliveredCount: 45,
        failedCount: 5,
        startedAt: new Date(Date.now() - 86400000 * 3),
        completedAt: new Date(Date.now() - 86400000 * 2),
      }),
    );

    // Seed message logs for completed campaign
    for (let j = 0; j < userContacts.length; j++) {
      const contact = userContacts[j];
      let status: MessageStatus;
      if (j < 5) status = MessageStatus.FAILED;
      else if (j < 20) status = MessageStatus.DELIVERED;
      else if (j < 50) status = MessageStatus.READ;
      else status = MessageStatus.DELIVERED;

      await messageRepo.save(
        messageRepo.create({
          campaignId: completed.id,
          contactId: contact.id,
          userId: user.id,
          direction: Direction.OUTBOUND,
          body: userTemplates[0].body.replace('{{name}}', contact.name ?? ''),
          status,
          waMessageId: `seed-${completed.id}-${j}`,
          sentAt: new Date(Date.now() - 86400000 * 3 + j * 2000),
          deliveredAt: status !== MessageStatus.FAILED ? new Date(Date.now() - 86400000 * 3 + j * 2000 + 5000) : undefined,
          readAt: status === MessageStatus.READ ? new Date(Date.now() - 86400000 * 2) : undefined,
          failReason: status === MessageStatus.FAILED ? 'Number not on WhatsApp' : undefined,
        }),
      );
    }

    // 2. RUNNING campaign
    await campaignRepo.save(
      campaignRepo.create({
        userId: user.id,
        sessionId: session.id,
        groupId: group.id,
        templateId: userTemplates[2].id,
        name: 'New Collection Launch',
        status: CampaignStatus.RUNNING,
        totalContacts: 50,
        sentCount: 20,
        deliveredCount: 18,
        failedCount: 2,
        startedAt: new Date(),
      }),
    );

    // 3. DRAFT campaign
    await campaignRepo.save(
      campaignRepo.create({
        userId: user.id,
        sessionId: session.id,
        groupId: group.id,
        templateId: userTemplates[1].id,
        name: 'Pahela Boishakh 2026',
        status: CampaignStatus.DRAFT,
        totalContacts: 50,
        scheduledAt: new Date(Date.now() + 86400000 * 7),
      }),
    );
  }

  console.log(`  Seeded 3 campaigns per user with message logs`);
}
