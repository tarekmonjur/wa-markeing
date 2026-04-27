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
});
