import { DataSource } from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Seeds 5 contacts per user whose birthday matches today's MM-DD.
 * This ensures the date automation fires immediately during a demo.
 */
export async function seedBirthdayTodayContacts(
  ds: DataSource,
  users: User[],
): Promise<void> {
  const contactRepo = ds.getRepository(Contact);
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const birthdayContacts = [
    { name: 'রাহুল চৌধুরী', phone: '+8801700099001', year: '1990' },
    { name: 'তানিয়া ইসলাম', phone: '+8801700099002', year: '1985' },
    { name: 'আরিফ হোসেন', phone: '+8801700099003', year: '1995' },
    { name: 'নাজমা আক্তার', phone: '+8801700099004', year: '1992' },
    { name: 'সাকিব আহমেদ', phone: '+8801700099005', year: '1988' },
  ];

  for (const user of users) {
    for (let i = 0; i < birthdayContacts.length; i++) {
      const c = birthdayContacts[i];
      const phone = c.phone.slice(0, -1) + String(users.indexOf(user)) + String(i);
      const existing = await contactRepo.findOne({
        where: { userId: user.id, phone },
      });

      if (!existing) {
        await contactRepo.save(
          contactRepo.create({
            userId: user.id,
            name: c.name,
            phone,
            customFields: {
              birthday: `${c.year}-${month}-${day}`,
              division: 'Dhaka',
            },
            optedOut: false,
          }),
        );
      }
    }
  }

  console.log(
    `  Seeded 5 birthday-today contacts per user (date: ${today.getFullYear()}-${month}-${day})`,
  );
}
