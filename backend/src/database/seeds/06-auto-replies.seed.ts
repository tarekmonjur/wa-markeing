import { DataSource } from 'typeorm';
import { AutoReplyRule, MatchType } from '../../auto-reply/entities/auto-reply-rule.entity';

export async function seedAutoReplies(
  ds: DataSource,
  users: { id: string }[],
): Promise<void> {
  const repo = ds.getRepository(AutoReplyRule);

  for (const user of users) {
    const existing = await repo.count({ where: { userId: user.id } });
    if (existing > 0) continue;

    const rules = [
      // System STOP rule (highest priority)
      {
        userId: user.id,
        keyword: 'stop',
        matchType: MatchType.EXACT,
        replyBody:
          'আপনার সাবস্ক্রিপশন বাতিল হয়েছে। পুনরায় পেতে START লিখুন।',
        priority: 9999,
        isActive: true,
      },
      // Bangla STOP variant
      {
        userId: user.id,
        keyword: 'বন্ধ',
        matchType: MatchType.CONTAINS,
        replyBody: 'আপনার সাবস্ক্রিপশন বাতিল হয়েছে।',
        priority: 9998,
        isActive: true,
      },
      // Price inquiry
      {
        userId: user.id,
        keyword: 'price',
        matchType: MatchType.CONTAINS,
        replyBody:
          'আমাদের মূল্য তালিকার জন্য আমাদের ওয়েবসাইট ভিজিট করুন অথবা কল করুন।',
        priority: 10,
        isActive: true,
      },
      {
        userId: user.id,
        keyword: 'দাম',
        matchType: MatchType.CONTAINS,
        replyBody:
          'আমাদের পণ্যের দাম জানতে 01712-XXXXXX তে কল করুন।',
        priority: 10,
        isActive: true,
      },
      // Order status
      {
        userId: user.id,
        keyword: 'order',
        matchType: MatchType.CONTAINS,
        replyBody:
          'Your order status: please provide your order number for tracking.',
        priority: 5,
        isActive: true,
      },
      {
        userId: user.id,
        keyword: 'অর্ডার',
        matchType: MatchType.CONTAINS,
        replyBody: 'আপনার অর্ডার নম্বরটি জানান, আমরা স্ট্যাটাস জানাব।',
        priority: 5,
        isActive: true,
      },
    ];

    for (const rule of rules) {
      await repo.save(repo.create(rule));
    }

    console.log(`  ✓ Seeded ${rules.length} auto-reply rules for user ${user.id}`);
  }
}
