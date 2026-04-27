import { DataSource } from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';
import { ContactGroup } from '../../contacts/entities/contact-group.entity';
import { User } from '../../users/entities/user.entity';

const BD_CONTACTS_DATA = [
  { name: 'Farhan Ahmed', phone: '+8801712345001', city: 'Dhaka', division: 'Dhaka', business: 'Retailer' },
  { name: 'Suraiya Begum', phone: '+8801812345002', city: 'Narayanganj', division: 'Dhaka', business: 'Wholesaler' },
  { name: 'Jamal Uddin', phone: '+8801912345003', city: 'Gazipur', division: 'Dhaka', business: 'Manufacturer' },
  { name: 'Roksana Parvin', phone: '+8801612345004', city: 'Chattogram', division: 'Chittagong', business: 'Exporter' },
  { name: 'Mosharraf Hossain', phone: '+8801712345005', city: 'Sylhet', division: 'Sylhet', business: 'Restaurant' },
  { name: 'Tahmina Khatun', phone: '+8801812345006', city: 'Rajshahi', division: 'Rajshahi', business: 'Distributor' },
  { name: 'Anwar Hossain', phone: '+8801912345007', city: 'Khulna', division: 'Khulna', business: 'Farmer' },
  { name: 'Sharmin Akter', phone: '+8801612345008', city: 'Comilla', division: 'Chittagong', business: 'Boutique' },
  { name: 'Delwar Islam', phone: '+8801712345009', city: 'Mymensingh', division: 'Mymensingh', business: 'Retailer' },
  { name: 'Moriom Begum', phone: '+8801812345010', city: 'Bogura', division: 'Rajshahi', business: 'Supplier' },
  { name: 'Iqbal Hasan', phone: '+8801912345011', city: 'Rangpur', division: 'Rangpur', business: 'Dealer' },
  { name: 'Rehana Yesmin', phone: '+8801612345012', city: 'Barisal', division: 'Barisal', business: 'Retailer' },
  { name: 'Shakil Ahmed', phone: '+8801712345013', city: 'Jessore', division: 'Khulna', business: 'Wholesaler' },
  { name: 'Monira Sultana', phone: '+8801812345014', city: 'Dinajpur', division: 'Rangpur', business: 'Farmer' },
  { name: 'Rafiq Sheikh', phone: '+8801912345015', city: 'Tangail', division: 'Dhaka', business: 'Manufacturer' },
  { name: 'Shamima Nasreen', phone: '+8801612345016', city: 'Brahmanbaria', division: 'Chittagong', business: 'Retailer' },
  { name: 'Habibur Rahman', phone: '+8801712345017', city: 'Pabna', division: 'Rajshahi', business: 'Dealer' },
  { name: 'Fatema Akhter', phone: '+8801812345018', city: 'Sirajganj', division: 'Rajshahi', business: 'Supplier' },
  { name: 'Kamrul Islam', phone: '+8801912345019', city: 'Kushtia', division: 'Khulna', business: 'Exporter' },
  { name: 'Sabina Yasmin', phone: '+8801612345020', city: 'Feni', division: 'Chittagong', business: 'Boutique' },
  { name: 'Nayeem Hossain', phone: '+8801712345021', city: 'Narsingdi', division: 'Dhaka', business: 'Manufacturer' },
  { name: 'Jharna Begum', phone: '+8801812345022', city: 'Manikganj', division: 'Dhaka', business: 'Retailer' },
  { name: 'Sumon Mia', phone: '+8801912345023', city: 'Chandpur', division: 'Chittagong', business: 'Wholesaler' },
  { name: 'Rumi Khatun', phone: '+8801612345024', city: 'Noakhali', division: 'Chittagong', business: 'Dealer' },
  { name: 'Zahid Hasan', phone: '+8801712345025', city: 'Netrokona', division: 'Mymensingh', business: 'Farmer' },
  { name: 'Ayesha Siddiqua', phone: '+8801812345026', city: 'Satkhira', division: 'Khulna', business: 'Retailer' },
  { name: 'Alamgir Hossain', phone: '+8801912345027', city: 'Jamalpur', division: 'Mymensingh', business: 'Supplier' },
  { name: 'Bilkis Banu', phone: '+8801612345028', city: 'Magura', division: 'Khulna', business: 'Distributor' },
  { name: 'Rony Chowdhury', phone: '+8801712345029', city: 'Habiganj', division: 'Sylhet', business: 'Restaurant' },
  { name: 'Khadija Akter', phone: '+8801812345030', city: 'Moulvibazar', division: 'Sylhet', business: 'Boutique' },
  { name: 'Shafiq Ahmed', phone: '+8801912345031', city: 'Sunamganj', division: 'Sylhet', business: 'Retailer' },
  { name: 'Nazmun Naher', phone: '+8801612345032', city: 'Lakshmipur', division: 'Chittagong', business: 'Dealer' },
  { name: 'Mizanur Rahman', phone: '+8801712345033', city: 'Pirojpur', division: 'Barisal', business: 'Farmer' },
  { name: 'Hosna Ara', phone: '+8801812345034', city: 'Bhola', division: 'Barisal', business: 'Supplier' },
  { name: 'Tanvir Ahmed', phone: '+8801912345035', city: 'Patuakhali', division: 'Barisal', business: 'Wholesaler' },
  { name: 'Salma Khatun', phone: '+8801612345036', city: 'Jhalokathi', division: 'Barisal', business: 'Retailer' },
  { name: 'Ripon Das', phone: '+8801712345037', city: 'Lalmonirhat', division: 'Rangpur', business: 'Dealer' },
  { name: 'Moushumi Akter', phone: '+8801812345038', city: 'Kurigram', division: 'Rangpur', business: 'Farmer' },
  { name: 'Jewel Mia', phone: '+8801912345039', city: 'Gaibandha', division: 'Rangpur', business: 'Manufacturer' },
  { name: 'Rokeya Begum', phone: '+8801612345040', city: 'Nilphamari', division: 'Rangpur', business: 'Supplier' },
  { name: 'Babul Sheikh', phone: '+8801712345041', city: 'Thakurgaon', division: 'Rangpur', business: 'Retailer' },
  { name: 'Hasina Akter', phone: '+8801812345042', city: 'Panchagarh', division: 'Rangpur', business: 'Boutique' },
  { name: 'Shahidul Islam', phone: '+8801912345043', city: 'Sherpur', division: 'Mymensingh', business: 'Wholesaler' },
  { name: 'Asma Khatun', phone: '+8801612345044', city: 'Kishoreganj', division: 'Dhaka', business: 'Distributor' },
  { name: 'Sohel Rana', phone: '+8801712345045', city: 'Munshiganj', division: 'Dhaka', business: 'Exporter' },
  { name: 'Nazma Begum', phone: '+8801812345046', city: 'Gopalganj', division: 'Dhaka', business: 'Retailer' },
  { name: 'Imran Hossain', phone: '+8801912345047', city: 'Madaripur', division: 'Dhaka', business: 'Dealer' },
  { name: 'Lovely Akter', phone: '+8801612345048', city: 'Shariatpur', division: 'Dhaka', business: 'Farmer' },
  { name: 'Masud Karim', phone: '+8801712345049', city: 'Faridpur', division: 'Dhaka', business: 'Supplier' },
  { name: 'Tania Islam', phone: '+8801812345050', city: 'Rajbari', division: 'Dhaka', business: 'Retailer' },
];

export async function seedContacts(
  ds: DataSource,
  users: User[],
): Promise<{ contacts: Map<string, Contact[]>; groups: Map<string, ContactGroup> }> {
  const contactRepo = ds.getRepository(Contact);
  const groupRepo = ds.getRepository(ContactGroup);
  const contacts = new Map<string, Contact[]>();
  const groups = new Map<string, ContactGroup>();

  for (const user of users) {
    const userContacts: Contact[] = [];

    for (const data of BD_CONTACTS_DATA) {
      const existing = await contactRepo.findOne({
        where: { userId: user.id, phone: data.phone },
      });
      if (existing) {
        userContacts.push(existing);
      } else {
        userContacts.push(
          await contactRepo.save(
            contactRepo.create({
              userId: user.id,
              name: data.name,
              phone: data.phone,
              customFields: {
                city: data.city,
                division: data.division,
                business: data.business,
              },
            }),
          ),
        );
      }
    }

    contacts.set(user.id, userContacts);

    // Create a group per user
    let group = await groupRepo.findOne({
      where: { userId: user.id, name: 'All BD Contacts' },
    });
    if (!group) {
      group = await groupRepo.save(
        groupRepo.create({
          userId: user.id,
          name: 'All BD Contacts',
          contacts: userContacts,
        }),
      );
    }
    groups.set(user.id, group);
  }

  console.log(`  Seeded ${BD_CONTACTS_DATA.length} contacts per user`);
  return { contacts, groups };
}
