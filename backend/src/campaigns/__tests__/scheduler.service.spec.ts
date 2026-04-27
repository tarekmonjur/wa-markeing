import { BadRequestException } from '@nestjs/common';
import { SchedulerService } from '../scheduler.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let mockQueue: any;
  let mockRepo: any;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn(),
    };
    mockRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    service = new SchedulerService(mockQueue, mockRepo);
  });

  it('throws BadRequestException if scheduledAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    await expect(service.scheduleCampaign('c1', pastDate)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('adds delayed BullMQ job with correct delay in milliseconds', async () => {
    const futureDate = new Date(Date.now() + 10_000);
    await service.scheduleCampaign('c1', futureDate);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'launch-campaign',
      { campaignId: 'c1' },
      expect.objectContaining({
        delay: expect.any(Number),
        jobId: 'launch-c1',
        removeOnComplete: true,
        removeOnFail: false,
      }),
    );

    const callArgs = mockQueue.add.mock.calls[0][2];
    expect(callArgs.delay).toBeGreaterThan(0);
    expect(callArgs.delay).toBeLessThanOrEqual(10_000);
  });

  it('uses idempotent jobId (launch:{campaignId}) to prevent duplicate jobs', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    await service.scheduleCampaign('uuid-abc', futureDate);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'launch-campaign',
      expect.anything(),
      expect.objectContaining({ jobId: 'launch-uuid-abc' }),
    );
  });

  it('cancelScheduledCampaign removes the BullMQ job and resets status to DRAFT', async () => {
    const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
    mockQueue.getJob.mockResolvedValue(mockJob);

    await service.cancelScheduledCampaign('c1');

    expect(mockQueue.getJob).toHaveBeenCalledWith('launch:c1');
    expect(mockJob.remove).toHaveBeenCalled();
    expect(mockRepo.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ status: 'DRAFT' }),
    );
  });

  it('cancelScheduledCampaign works even if job not found', async () => {
    mockQueue.getJob.mockResolvedValue(null);

    await expect(service.cancelScheduledCampaign('c1')).resolves.not.toThrow();
    expect(mockRepo.update).toHaveBeenCalled();
  });

  it('rescheduling replaces the old job with a new delayed job', async () => {
    const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
    mockQueue.getJob.mockResolvedValue(mockJob);

    const futureDate = new Date(Date.now() + 120_000);
    await service.rescheduleCampaign('c1', futureDate);

    expect(mockJob.remove).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith(
      'launch-campaign',
      { campaignId: 'c1' },
      expect.objectContaining({ jobId: 'launch-c1' }),
    );
  });

  it('updates campaign status to SCHEDULED on successful schedule', async () => {
    const futureDate = new Date(Date.now() + 30_000);
    await service.scheduleCampaign('c1', futureDate);

    expect(mockRepo.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ status: 'SCHEDULED', scheduledAt: futureDate }),
    );
  });
});
