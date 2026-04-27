import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WaSession } from './entities/wa-session.entity';
import { SessionStatus } from '../database/enums';
import { UpdateSessionDto } from './dto';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(WaSession)
    private readonly sessionRepository: Repository<WaSession>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSession(userId: string, displayName: string, phoneNumber: string): Promise<WaSession> {
    const session = this.sessionRepository.create({
      userId,
      displayName,
      phoneNumber,
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

  async updateSession(userId: string, id: string, dto: UpdateSessionDto): Promise<WaSession> {
    const session = await this.findSession(userId, id);
    if (dto.displayName !== undefined) session.displayName = dto.displayName;
    if (dto.phoneNumber !== undefined) session.phoneNumber = dto.phoneNumber;
    return this.sessionRepository.save(session);
  }

  async updateSessionStatusForUser(
    userId: string,
    sessionId: string,
    status: string,
    phoneNumber?: string,
    displayName?: string,
  ): Promise<WaSession> {
    const session = await this.findSession(userId, sessionId);
    return this.updateSessionStatus(
      session.id,
      status as SessionStatus,
      phoneNumber,
      displayName,
    );
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

  async disconnectSession(userId: string, id: string): Promise<WaSession> {
    const session = await this.findSession(userId, id);
    session.status = SessionStatus.DISCONNECTED;
    const saved = await this.sessionRepository.save(session);
    this.eventEmitter.emit('session.status', { sessionId: saved.id, status: saved.status });
    this.logger.log(`Session disconnected: ${id}`);
    return saved;
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await this.findSession(userId, id);
    await this.sessionRepository.remove(session);
    this.logger.log(`Session deleted: ${id}`);
  }
}
