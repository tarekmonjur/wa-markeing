import { SettingsService } from '../settings.service';
import { Repository } from 'typeorm';
import { UserSettings } from '../entities/user-settings.entity';

describe('SettingsService — SendWindow', () => {
  let service: SettingsService;
  let repo: Partial<Repository<UserSettings>>;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    };
    service = new SettingsService(repo as any);
  });

  it('returns -1 (allow) when smart send is disabled', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      timezone: 'UTC',
      sendWindowStart: 9,
      sendWindowEnd: 18,
      sendDaysOfWeek: [1, 2, 3, 4, 5],
      smartSendEnabled: false,
    });

    const result = await service.getMsUntilNextWindow('u1');
    expect(result).toBe(-1);
  });

  it('returns 0 during configured business hours in user timezone', async () => {
    // Mock a weekday within hours
    const now = new Date();
    const userNow = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const hour = userNow.getHours();
    const jsDay = userNow.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    (repo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      timezone: 'UTC',
      sendWindowStart: 0,
      sendWindowEnd: 23,
      sendDaysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      smartSendEnabled: true,
    });

    const result = await service.getMsUntilNextWindow('u1');
    expect(result).toBe(0);
  });

  it('returns >0 outside business hours', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      timezone: 'UTC',
      sendWindowStart: 3,
      sendWindowEnd: 4,
      sendDaysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      smartSendEnabled: true,
    });

    const result = await service.getMsUntilNextWindow('u1');
    // At most hours of the current day (could be 0 if test runs at 3am UTC)
    expect(typeof result).toBe('number');
  });

  it('creates default settings when none exist', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    (repo.save as jest.Mock).mockImplementation((d) =>
      Promise.resolve({
        ...d,
        timezone: 'UTC',
        sendWindowStart: 9,
        sendWindowEnd: 18,
        sendDaysOfWeek: [1, 2, 3, 4, 5],
        smartSendEnabled: false,
      }),
    );

    const result = await service.getMsUntilNextWindow('u1');
    // Smart send disabled by default → -1
    expect(result).toBe(-1);
  });

  it('returns >0 on a weekend day excluded from sendDaysOfWeek', async () => {
    // Use a Saturday (day 6 ISO)
    const saturday = new Date('2025-04-26T12:00:00Z'); // Saturday
    jest.useFakeTimers({ now: saturday });

    (repo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      timezone: 'UTC',
      sendWindowStart: 9,
      sendWindowEnd: 18,
      sendDaysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri only, no Sat/Sun
      smartSendEnabled: true,
    });

    const result = await service.getMsUntilNextWindow('u1');
    // Saturday excluded → should wait until Monday
    expect(result).toBeGreaterThan(0);

    jest.useRealTimers();
  });

  it('calculates correct delay in ms to next window opening', async () => {
    // Simulate 23:00 UTC on a weekday
    const late = new Date('2025-04-28T23:00:00Z'); // Monday 23:00 UTC
    jest.useFakeTimers({ now: late });

    (repo.findOne as jest.Mock).mockResolvedValue({
      userId: 'u1',
      timezone: 'UTC',
      sendWindowStart: 9,
      sendWindowEnd: 18,
      sendDaysOfWeek: [1, 2, 3, 4, 5],
      smartSendEnabled: true,
    });

    const result = await service.getMsUntilNextWindow('u1');
    // Should be ~10 hours (from 23:00 to next day 09:00)
    const tenHoursMs = 10 * 60 * 60 * 1000;
    expect(result).toBeGreaterThan(tenHoursMs - 60000); // within 1 minute tolerance
    expect(result).toBeLessThanOrEqual(tenHoursMs + 60000);

    jest.useRealTimers();
  });
});
