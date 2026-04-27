import { Repository, SelectQueryBuilder } from 'typeorm';
import { Queue } from 'bullmq';
import { DateAutomationService } from '../date-automation.service';
import { DateAutomation } from '../entities/date-automation.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { SettingsService } from '../../settings/settings.service';

describe('DateAutomationService', () => {
  let service: DateAutomationService;
  let automationRepo: Partial<Repository<DateAutomation>>;
  let contactRepo: Partial<Repository<Contact>>;
  let campaignQueue: Partial<Queue>;
  let settingsService: Partial<SettingsService>;

  const mockQueryBuilder = () => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  beforeEach(() => {
    automationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 'auto-1' })),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    contactRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder()),
    };

    campaignQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    settingsService = {
      getOrCreate: jest.fn().mockResolvedValue({
        userId: 'user-1',
        timezone: 'UTC',
        sendWindowStart: 9,
        sendWindowEnd: 18,
        sendDaysOfWeek: [1, 2, 3, 4, 5],
        smartSendEnabled: false,
      }),
    };

    service = new DateAutomationService(
      automationRepo as any,
      contactRepo as any,
      campaignQueue as any,
      settingsService as any,
    );
  });

  it('matches contacts by birthday MM-DD regardless of year', async () => {
    const mockContact = {
      id: 'c-1',
      phone: '+8801712345678',
      name: 'Rahim',
      email: '',
      customFields: { birthday: '1990-04-28' },
      optedOut: false,
    };

    const qb = mockQueryBuilder();
    qb.getMany.mockResolvedValue([mockContact]);
    (contactRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    (automationRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'auto-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        templateId: 'tmpl-1',
        fieldName: 'birthday',
        sendTime: '09:00',
        isActive: true,
        template: { body: 'Happy Birthday {{name}}!', mediaUrl: null, mediaType: null },
      },
    ]);

    await service.dailyAutomationCheck();

    expect(campaignQueue.add).toHaveBeenCalledWith(
      'send-message',
      expect.objectContaining({
        phone: '+8801712345678',
        body: 'Happy Birthday Rahim!',
      }),
      expect.anything(),
    );
  });

  it('skips opted-out contacts', async () => {
    const qb = mockQueryBuilder();
    // The query itself filters optedOut=false, so no results
    qb.getMany.mockResolvedValue([]);
    (contactRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    (automationRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'auto-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        templateId: 'tmpl-1',
        fieldName: 'birthday',
        sendTime: '09:00',
        isActive: true,
        template: { body: 'HBD {{name}}!' },
      },
    ]);

    await service.dailyAutomationCheck();

    expect(campaignQueue.add).not.toHaveBeenCalled();
  });

  it('skips contacts with missing date value', async () => {
    const qb = mockQueryBuilder();
    // Query filters for non-null, so returns empty
    qb.getMany.mockResolvedValue([]);
    (contactRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    (automationRepo.find as jest.Mock).mockResolvedValue([
      {
        id: 'auto-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        templateId: 'tmpl-1',
        fieldName: 'birthday',
        sendTime: '09:00',
        isActive: true,
        template: { body: 'HBD!' },
      },
    ]);

    await service.dailyAutomationCheck();
    expect(campaignQueue.add).not.toHaveBeenCalled();
  });
});
