import { DataSource } from 'typeorm';
import { Template } from '../../templates/entities/template.entity';
import { User } from '../../users/entities/user.entity';

const BD_TEMPLATES = [
  {
    name: 'Eid Special Offer',
    body: 'আস্সালামু আলাইকুম {{name}} ভাই! 🌙 ঈদ উপলক্ষে সকল পণ্যে ২০% ছাড়! অফার সীমিত সময়ের। অর্ডার করুন: 01712-XXXXXX',
  },
  {
    name: 'Pahela Boishakh Promo',
    body: 'শুভ নববর্ষ {{name}}! 🎉 পহেলা বৈশাখ উপলক্ষে বিশেষ ছাড় — যেকোনো পণ্যে ১৫% অফ। শোরুম: {{custom.city}}',
  },
  {
    name: 'New Collection — English',
    body: 'Hi {{name}}, our new winter collection is now available! 🧥 Premium RMG quality. WhatsApp for the full catalogue. Delivery across Bangladesh.',
  },
  {
    name: 'Payment Reminder',
    body: 'Dear {{name}}, আপনার অর্ডারের বাকি পেমেন্ট Tk.{{custom.amount}} পেন্ডিং। bKash/Nagad: 01712-XXXXXX. ধন্যবাদ 🙏',
  },
  {
    name: 'Delivery Confirmation',
    body: '✅ সুখবর {{name}}! আপনার পণ্য আজ ডেলিভারি হবে। ট্র্যাক করুন: {{custom.trackingUrl}}. কল করুন: 01812-XXXXXX',
  },
];

export async function seedTemplates(
  ds: DataSource,
  users: User[],
): Promise<Map<string, Template[]>> {
  const repo = ds.getRepository(Template);
  const result = new Map<string, Template[]>();

  for (const user of users) {
    const templates: Template[] = [];
    for (const data of BD_TEMPLATES) {
      const existing = await repo.findOne({
        where: { userId: user.id, name: data.name },
      });
      if (existing) {
        templates.push(existing);
      } else {
        templates.push(
          await repo.save(
            repo.create({ userId: user.id, name: data.name, body: data.body }),
          ),
        );
      }
    }
    result.set(user.id, templates);
  }

  console.log(`  Seeded ${BD_TEMPLATES.length} templates per user`);
  return result;
}
