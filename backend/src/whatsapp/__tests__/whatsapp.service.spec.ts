import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { WhatsappService } from '../whatsapp.service';
import { WaSession } from '../entities/wa-session.entity';
import { SessionStatus } from '../../database/enums';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let sessionRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    sessionRepo = {
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 's1', ...d })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        { provide: getRepositoryToken(WaSession), useValue: sessionRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(WhatsappService);
  });

  it('should create a session', async () => {
    const result = await service.createSession('u1');
    expect(result).toHaveProperty('id');
    expect(sessionRepo.create).toHaveBeenCalledWith({
      userId: 'u1',
      status: SessionStatus.DISCONNECTED,
    });
  });

  it('should find session by id', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 's1', userId: 'u1' });
    const result = await service.findSession('u1', 's1');
    expect(result.id).toBe('s1');
  });

  it('should throw NotFoundException if session not found', async () => {
    sessionRepo.findOne.mockResolvedValue(null);
    await expect(service.findSession('u1', 'bad')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should delete a session', async () => {
    sessionRepo.findOne.mockResolvedValue({ id: 's1', userId: 'u1' });
    await service.deleteSession('u1', 's1');
    expect(sessionRepo.remove).toHaveBeenCalled();
  });
});
