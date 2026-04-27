import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WaSession } from './entities/wa-session.entity';
import { SessionStatus } from '../database/enums';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WaSession)
    private readonly sessionRepository: Repository<WaSession>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSession(userId: string): Promise<WaSession> {
    const session = this.sessionRepository.create({
      userId,
      status: SessionStatus.DISCONNECTED,
    });
    const saved = await this.sessionRepository.save(session);
    this.logger.log(`Session created: ${saved.id} for user ${userId}`);
    return saved;
  }

  async findAllSessions(userId: string): Promise<WaSession[]> {
    return this.sessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findSession(userId: string, id: string): Promise<WaSession> {
    const session = await this.sessionRepository.findOne({
      where: { id, userId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    phoneNumber?: string,
    displayName?: string,
  ): Promise<WaSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.status = status;
    if (phoneNumber) session.phoneNumber = phoneNumber;
    if (displayName) session.displayName = displayName;
    if (status === SessionStatus.CONNECTED) {
      session.lastSeenAt = new Date();
    }

    const saved = await this.sessionRepository.save(session);

    this.eventEmitter.emit('session.status', {
      sessionId: saved.id,
      status: saved.status,
    });

    return saved;
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await this.findSession(userId, id);
    await this.sessionRepository.remove(session);
    this.logger.log(`Session deleted: ${id}`);
  }
}
