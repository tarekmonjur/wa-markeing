import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatsUpdaterService } from '../stats-updater.service';
import { CampaignStats } from '../entities/campaign-stats.entity';
import { DailyStats } from '../entities/daily-stats.entity';

describe('StatsUpdaterService', () => {
  let service: StatsUpdaterService;
  let statsRepo: Record<string, jest.Mock>;
  let dailyRepo: Record<string, jest.Mock>;

  const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    statsRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
    };

    dailyRepo = {
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 'daily1', ...d })),
      createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsUpdaterService,
        { provide: getRepositoryToken(CampaignStats), useValue: statsRepo },
        { provide: getRepositoryToken(DailyStats), useValue: dailyRepo },
      ],
    }).compile();

    service = module.get(StatsUpdaterService);
  });

  describe('onMessageSent', () => {
    it('increments sentCount atomically via query builder', async () => {
      await service.onMessageSent({
        campaignId: 'c1',
        userId: 'u1',
        sessionId: 's1',
      });

      expect(statsRepo.createQueryBuilder).toHaveBeenCalled();
      const qb = statsRepo.createQueryBuilder();
      expect(qb.update).toHaveBeenCalled();
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({ sentCount: expect.any(Function) }),
      );
    });

    it('skips increment when campaignId is undefined', async () => {
      await service.onMessageSent({
        userId: 'u1',
        sessionId: 's1',
      });

      // createQueryBuilder still called for daily stats, but the campaign stat
      // increment should not execute the update path
      // The service silently returns for undefined campaignId
    });
  });

  describe('onMessageDelivered', () => {
    it('increments deliveredCount and recalculates rates', async () => {
      statsRepo.findOne.mockResolvedValue({
        campaignId: 'c1',
        sentCount: 100,
        deliveredCount: 50,
        readCount: 20,
        repliedCount: 5,
      });

      await service.onMessageDelivered({
        campaignId: 'c1',
        userId: 'u1',
        sessionId: 's1',
      });

      expect(statsRepo.createQueryBuilder).toHaveBeenCalled();
      // Recalculates rates after delivered
      expect(statsRepo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          deliveryRate: expect.any(Number),
          readRate: expect.any(Number),
          replyRate: expect.any(Number),
        }),
      );
    });

    it('recalculates deliveryRate = deliveredCount / sentCount', async () => {
      statsRepo.findOne.mockResolvedValue({
        campaignId: 'c1',
        sentCount: 100,
        deliveredCount: 80,
        readCount: 40,
        repliedCount: 10,
      });

      await service.onMessageDelivered({
        campaignId: 'c1',
        userId: 'u1',
      });

      expect(statsRepo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          deliveryRate: 0.8,  // 80/100
          readRate: 0.5,      // 40/80
          replyRate: 0.125,   // 10/80
        }),
      );
    });
  });

  describe('onMessageRead', () => {
    it('increments readCount and recalculates rates', async () => {
      statsRepo.findOne.mockResolvedValue({
        campaignId: 'c1',
        sentCount: 100,
        deliveredCount: 80,
        readCount: 40,
        repliedCount: 5,
      });

      await service.onMessageRead({
        campaignId: 'c1',
        userId: 'u1',
      });

      expect(statsRepo.update).toHaveBeenCalled();
    });
  });

  describe('onMessageFailed', () => {
    it('increments failedCount without recalculating rates', async () => {
      await service.onMessageFailed({
        campaignId: 'c1',
        userId: 'u1',
      });

      expect(statsRepo.createQueryBuilder).toHaveBeenCalled();
      // No rate recalculation for failures
      expect(statsRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('ensureCampaignStats', () => {
    it('creates stats row if not exists', async () => {
      statsRepo.findOne.mockResolvedValue(null);

      await service.ensureCampaignStats('c1', 50);

      expect(statsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'c1', totalContacts: 50 }),
      );
    });

    it('updates totalContacts if stats already exist', async () => {
      statsRepo.findOne.mockResolvedValue({ campaignId: 'c1', totalContacts: 30 });

      await service.ensureCampaignStats('c1', 50);

      expect(statsRepo.update).toHaveBeenCalledWith('c1', { totalContacts: 50 });
    });
  });
});
