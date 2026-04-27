import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DripService } from '../drip.service';
import { EnrollStatus } from '../entities/drip-enrollment.entity';
import { StepCondition } from '../entities/drip-step.entity';
import { Direction } from '../../database/enums';
import { createMockRepository } from '../../../test/helpers/mock-repository';

describe('DripService', () => {
  let service: DripService;
  let sequenceRepo: any;
  let stepRepo: any;
  let enrollmentRepo: any;
  let contactRepo: any;
  let messageLogRepo: any;
  let templateRepo: any;
  let dripQueue: any;
  let variableEngine: any;
  let configService: any;

  beforeEach(() => {
    sequenceRepo = createMockRepository();
    stepRepo = createMockRepository();
    enrollmentRepo = createMockRepository();
    contactRepo = createMockRepository();
    messageLogRepo = createMockRepository();
    templateRepo = createMockRepository();
    dripQueue = { add: jest.fn().mockResolvedValue(undefined) };
    variableEngine = { resolve: jest.fn((body: string) => body) };
    configService = { get: jest.fn().mockReturnValue('http://session-manager:3002') };

    service = new DripService(
      sequenceRepo,
      stepRepo,
      enrollmentRepo,
      contactRepo,
      messageLogRepo,
      templateRepo,
      dripQueue,
      variableEngine,
      configService,
    );
  });

  describe('enroll()', () => {
    const userId = 'u1';
    const sequenceId = 'seq1';
    const baseSequence = { id: sequenceId, userId, isActive: true, steps: [], enrollments: [] };

    beforeEach(() => {
      sequenceRepo.findOne.mockResolvedValue(baseSequence);
      stepRepo.find.mockResolvedValue([
        { id: 's1', sequenceId, stepNumber: 1, delayHours: 0, condition: StepCondition.ALWAYS },
      ]);
      enrollmentRepo.findOne.mockResolvedValue(null);
      enrollmentRepo.create.mockImplementation((data: any) => ({ id: 'enr1', ...data }));
      enrollmentRepo.save.mockImplementation((data: any) => Promise.resolve(data));
    });

    it('skips opted-out contacts silently', async () => {
      contactRepo.findOne.mockResolvedValue({ id: 'c1', userId, optedOut: true });

      const result = await service.enroll(userId, sequenceId, {
        contactIds: ['c1'],
        sessionId: 'sess1',
      });

      expect(result.skipped).toBe(1);
      expect(result.enrolled).toBe(0);
    });

    it('skips contacts that don\'t exist', async () => {
      contactRepo.findOne.mockResolvedValue(null);

      const result = await service.enroll(userId, sequenceId, {
        contactIds: ['nonexistent'],
        sessionId: 'sess1',
      });

      expect(result.skipped).toBe(1);
      expect(result.enrolled).toBe(0);
    });

    it('upserts enrollments idempotently (no duplicate on re-enroll)', async () => {
      contactRepo.findOne.mockResolvedValue({ id: 'c1', userId, optedOut: false });
      enrollmentRepo.findOne.mockResolvedValue({ id: 'enr-existing', sequenceId, contactId: 'c1' });

      const result = await service.enroll(userId, sequenceId, {
        contactIds: ['c1'],
        sessionId: 'sess1',
      });

      expect(result.skipped).toBe(1);
      expect(result.enrolled).toBe(0);
      expect(enrollmentRepo.save).not.toHaveBeenCalled();
    });

    it('enrolls valid contacts and schedules step 1', async () => {
      contactRepo.findOne.mockResolvedValue({ id: 'c1', userId, optedOut: false });

      const result = await service.enroll(userId, sequenceId, {
        contactIds: ['c1'],
        sessionId: 'sess1',
      });

      expect(result.enrolled).toBe(1);
      expect(dripQueue.add).toHaveBeenCalledWith(
        'process-drip-step',
        expect.objectContaining({ enrollmentId: 'enr1', stepNumber: 1 }),
        expect.objectContaining({
          jobId: 'drip:enr1:step:1',
          removeOnComplete: true,
        }),
      );
    });

    it('throws if sequence is not active', async () => {
      sequenceRepo.findOne.mockResolvedValue({ ...baseSequence, isActive: false });

      await expect(
        service.enroll(userId, sequenceId, { contactIds: ['c1'], sessionId: 'sess1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if sequence has no steps', async () => {
      stepRepo.find.mockResolvedValue([]);

      await expect(
        service.enroll(userId, sequenceId, { contactIds: ['c1'], sessionId: 'sess1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processDripStep()', () => {
    const enrollment = {
      id: 'enr1',
      sequenceId: 'seq1',
      contactId: 'c1',
      sessionId: 'sess1',
      currentStep: 1,
      status: EnrollStatus.ACTIVE,
      contact: { id: 'c1', phone: '+8801712345678', optedOut: false },
    };

    beforeEach(() => {
      enrollmentRepo.findOne.mockResolvedValue({ ...enrollment });
      enrollmentRepo.save.mockImplementation((data: any) => Promise.resolve(data));
    });

    it('skips step when status is not ACTIVE', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        ...enrollment,
        status: EnrollStatus.PAUSED,
      });

      await service.processDripStep('enr1', 1);
      // Should not attempt to send message
      expect(stepRepo.findOne).not.toHaveBeenCalled();
    });

    it('NO_REPLY condition skips step when contact replied', async () => {
      stepRepo.findOne
        .mockResolvedValueOnce({
          id: 's1',
          sequenceId: 'seq1',
          stepNumber: 1,
          delayHours: 24,
          condition: StepCondition.NO_REPLY,
          templateId: 't1',
          template: null,
        })
        .mockResolvedValueOnce(null); // no next step

      // Contact has replied (1 inbound message)
      messageLogRepo.count.mockResolvedValue(1);

      await service.processDripStep('enr1', 1);

      // Should mark completed since no next step
      expect(enrollmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EnrollStatus.COMPLETED }),
      );
    });

    it('marks enrollment COMPLETED after last step', async () => {
      stepRepo.findOne
        .mockResolvedValueOnce({
          id: 's1',
          sequenceId: 'seq1',
          stepNumber: 1,
          delayHours: 0,
          condition: StepCondition.ALWAYS,
          templateId: 't1',
          template: { id: 't1', body: 'Hello {{name}}' },
        })
        .mockResolvedValueOnce(null); // no next step

      // Mock fetch for sending
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ waMessageId: 'wa1' }),
      });
      messageLogRepo.create.mockImplementation((data: any) => data);
      messageLogRepo.save.mockResolvedValue({});

      await service.processDripStep('enr1', 1);

      expect(enrollmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EnrollStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
      );
    });

    it('schedules next step with correct delay in ms', async () => {
      const nextStep = {
        id: 's2',
        sequenceId: 'seq1',
        stepNumber: 2,
        delayHours: 48,
        condition: StepCondition.ALWAYS,
      };

      stepRepo.findOne
        .mockResolvedValueOnce({
          id: 's1',
          sequenceId: 'seq1',
          stepNumber: 1,
          delayHours: 0,
          condition: StepCondition.ALWAYS,
          templateId: 't1',
          template: { id: 't1', body: 'Hello' },
        })
        .mockResolvedValueOnce(nextStep);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ waMessageId: 'wa1' }),
      });
      messageLogRepo.create.mockImplementation((data: any) => data);
      messageLogRepo.save.mockResolvedValue({});

      await service.processDripStep('enr1', 1);

      expect(dripQueue.add).toHaveBeenCalledWith(
        'process-drip-step',
        { enrollmentId: 'enr1', stepNumber: 2 },
        expect.objectContaining({
          delay: 48 * 3600000,
          jobId: 'drip:enr1:step:2',
        }),
      );
    });

    it('marks enrollment UNSUBSCRIBED when contact opted out', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        ...enrollment,
        contact: { ...enrollment.contact, optedOut: true },
      });

      stepRepo.findOne.mockResolvedValue({
        id: 's1',
        sequenceId: 'seq1',
        stepNumber: 1,
        delayHours: 0,
        condition: StepCondition.ALWAYS,
        templateId: 't1',
      });

      await service.processDripStep('enr1', 1);

      expect(enrollmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EnrollStatus.UNSUBSCRIBED }),
      );
    });
  });
});
