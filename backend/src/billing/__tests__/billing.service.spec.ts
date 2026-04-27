import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingService } from '../billing.service';
import { PlanUsage } from '../entities/plan-usage.entity';

describe('BillingService — PlanUsage', () => {
  let service: BillingService;
  let repo: Partial<Repository<PlanUsage>>;
  let savedUsage: Partial<PlanUsage>;

  beforeEach(() => {
    savedUsage = {
      userId: 'user-1',
      contactCount: 5,
      sessionsCount: 1,
      campaignsThisMonth: 2,
      messagesToday: 10,
      aiGenerationsToday: 3,
      lastDailyResetAt: new Date(),
      lastMonthlyResetAt: new Date(),
    } as PlanUsage;

    repo = {
      findOne: jest.fn().mockResolvedValue(savedUsage),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      update: jest.fn().mockResolvedValue(undefined),
    };

    service = new BillingService(repo as any);
  });

  it('increments contactCount on contact.created event', async () => {
    await service.onContactCreated({ userId: 'user-1' });
    expect(repo.update).toHaveBeenCalledWith('user-1', { contactCount: 6 });
  });

  it('decrements contactCount on contact.deleted event', async () => {
    await service.onContactDeleted({ userId: 'user-1' });
    expect(repo.update).toHaveBeenCalledWith('user-1', { contactCount: 4 });
  });

  it('does not go below 0 on contact.deleted', async () => {
    savedUsage.contactCount = 0;
    await service.onContactDeleted({ userId: 'user-1' });
    expect(repo.update).toHaveBeenCalledWith('user-1', { contactCount: 0 });
  });

  it('increments campaignsThisMonth on campaign.created event', async () => {
    await service.onCampaignCreated({ userId: 'user-1' });
    expect(repo.update).toHaveBeenCalledWith('user-1', { campaignsThisMonth: 3 });
  });

  it('returns usage mapped to plan config keys', async () => {
    const usage = await service.getUsageForGuard('user-1');
    expect(usage).toEqual({
      maxContacts: 5,
      maxSessions: 1,
      maxCampaignsPerMonth: 2,
      maxMessagesPerDay: 10,
      aiGenerationsPerDay: 3,
    });
  });

  it('creates usage record when none exists', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    (repo.save as jest.Mock).mockImplementation((d) =>
      Promise.resolve({
        ...d,
        contactCount: 0,
        sessionsCount: 0,
        campaignsThisMonth: 0,
        messagesToday: 0,
        aiGenerationsToday: 0,
        lastDailyResetAt: new Date(),
        lastMonthlyResetAt: new Date(),
      }),
    );

    const result = await service.getOrCreateUsage('new-user');
    expect(repo.create).toHaveBeenCalledWith({ userId: 'new-user' });
  });
});
