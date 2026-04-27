import { DataSource } from 'typeorm';
import { DateAutomation } from '../../automations/entities/date-automation.entity';
import { User } from '../../users/entities/user.entity';
import { Template } from '../../templates/entities/template.entity';
import { WaSession } from '../../whatsapp/entities/wa-session.entity';

export async function seedDateAutomations(
  ds: DataSource,
  users: User[],
): Promise<void> {
  const automationRepo = ds.getRepository(DateAutomation);
  const templateRepo = ds.getRepository(Template);
  const sessionRepo = ds.getRepository(WaSession);

  for (const user of users) {
    // Get a session and template
    const session = await sessionRepo.findOne({ where: { userId: user.id } });
    const template = await templateRepo.findOne({ where: { userId: user.id } });
    if (!session || !template) continue;

    const automations = [
      {
        userId: user.id,
        sessionId: session.id,
        templateId: template.id,
        fieldName: 'birthday',
        sendTime: '09:00',
        isActive: true,
      },
      {
        userId: user.id,
        sessionId: session.id,
        templateId: template.id,
        fieldName: 'anniversary',
        sendTime: '10:00',
        isActive: true,
      },
    ];

    for (const data of automations) {
      const existing = await automationRepo.findOne({
        where: { userId: data.userId, fieldName: data.fieldName },
      });
      if (!existing) {
        await automationRepo.save(automationRepo.create(data));
      }
    }
  }

  console.log(`  Seeded date automations for ${users.length} users`);
}
