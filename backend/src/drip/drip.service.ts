import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DripSequence } from './entities/drip-sequence.entity';
import { DripStep, StepCondition } from './entities/drip-step.entity';
import { DripEnrollment, EnrollStatus } from './entities/drip-enrollment.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { MessageLog } from '../analytics/entities/message-log.entity';
import { Template } from '../templates/entities/template.entity';
import { VariableEngineService } from '../templates/variable-engine.service';
import { MessageStatus, Direction } from '../database/enums';
import {
  CreateDripSequenceDto,
  UpdateDripSequenceDto,
  EnrollContactsDto,
} from './dto';

@Injectable()
export class DripService {
  private readonly logger = new Logger(DripService.name);
  private readonly sessionManagerUrl: string;

  constructor(
    @InjectRepository(DripSequence)
    private readonly sequenceRepository: Repository<DripSequence>,
    @InjectRepository(DripStep)
    private readonly stepRepository: Repository<DripStep>,
    @InjectRepository(DripEnrollment)
    private readonly enrollmentRepository: Repository<DripEnrollment>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepository: Repository<MessageLog>,
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    @InjectQueue('drip')
    private readonly dripQueue: Queue,
    private readonly variableEngine: VariableEngineService,
    private readonly configService: ConfigService,
  ) {
    this.sessionManagerUrl =
      this.configService.get<string>('SESSION_MANAGER_URL') ??
      'http://session-manager:3002';
  }

  async create(
    userId: string,
    dto: CreateDripSequenceDto,
  ): Promise<DripSequence> {
    const sequence = await this.sequenceRepository.save(
      this.sequenceRepository.create({ userId, name: dto.name }),
    );

    if (dto.steps?.length) {
      for (const stepDto of dto.steps) {
        await this.stepRepository.save(
          this.stepRepository.create({
            sequenceId: sequence.id,
            ...stepDto,
          }),
        );
      }
    }

    return this.findById(userId, sequence.id);
  }

  async findAll(userId: string): Promise<DripSequence[]> {
    return this.sequenceRepository.find({
      where: { userId },
      relations: ['steps', 'enrollments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(userId: string, id: string): Promise<DripSequence> {
    const seq = await this.sequenceRepository.findOne({
      where: { id, userId },
      relations: ['steps', 'enrollments'],
    });
    if (!seq) throw new NotFoundException('Drip sequence not found');
    return seq;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDripSequenceDto,
  ): Promise<DripSequence> {
    const seq = await this.findById(userId, id);
    Object.assign(seq, dto);
    await this.sequenceRepository.save(seq);
    return this.findById(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const seq = await this.findById(userId, id);
    await this.sequenceRepository.remove(seq);
  }

  async addStep(
    userId: string,
    sequenceId: string,
    stepDto: any,
  ): Promise<DripStep> {
    await this.findById(userId, sequenceId);
    const step = this.stepRepository.create({ sequenceId, ...stepDto });
    const saved = await this.stepRepository.save(step);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async removeStep(userId: string, sequenceId: string, stepId: string): Promise<void> {
    await this.findById(userId, sequenceId);
    const step = await this.stepRepository.findOne({ where: { id: stepId, sequenceId } });
    if (!step) throw new NotFoundException('Step not found');
    await this.stepRepository.remove(step);
  }

  /**
   * Enroll contacts into a drip sequence.
   */
  async enroll(
    userId: string,
    sequenceId: string,
    dto: EnrollContactsDto,
  ): Promise<{ enrolled: number; skipped: number }> {
    const sequence = await this.findById(userId, sequenceId);

    if (!sequence.isActive) {
      throw new BadRequestException('Sequence is not active');
    }

    const steps = await this.stepRepository.find({
      where: { sequenceId },
      order: { stepNumber: 'ASC' },
    });

    if (steps.length === 0) {
      throw new BadRequestException('Sequence has no steps');
    }

    let enrolled = 0;
    let skipped = 0;

    for (const contactId of dto.contactIds) {
      const contact = await this.contactRepository.findOne({
        where: { id: contactId, userId },
      });

      // Skip opted-out contacts
      if (!contact || contact.optedOut) {
        skipped++;
        continue;
      }

      // Upsert enrollment (idempotent)
      const existing = await this.enrollmentRepository.findOne({
        where: { sequenceId, contactId },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const enrollment = await this.enrollmentRepository.save(
        this.enrollmentRepository.create({
          sequenceId,
          contactId,
          sessionId: dto.sessionId,
          currentStep: 1,
          status: EnrollStatus.ACTIVE,
        }),
      );

      // Schedule Step 1
      const firstStep = steps[0];
      const delay = firstStep.delayHours * 3600000;

      await this.dripQueue.add(
        'process-drip-step',
        {
          enrollmentId: enrollment.id,
          stepNumber: 1,
        },
        {
          delay: Math.max(delay, 0),
          jobId: `drip-${enrollment.id}-step-1`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      enrolled++;
    }

    return { enrolled, skipped };
  }

  /**
   * Process a drip step (called by BullMQ worker).
   */
  async processDripStep(
    enrollmentId: string,
    stepNumber: number,
  ): Promise<void> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id: enrollmentId },
      relations: ['contact'],
    });

    if (!enrollment || enrollment.status !== EnrollStatus.ACTIVE) {
      this.logger.debug(
        `Skipping drip step: enrollment ${enrollmentId} is ${enrollment?.status}`,
      );
      return;
    }

    const step = await this.stepRepository.findOne({
      where: { sequenceId: enrollment.sequenceId, stepNumber },
      relations: ['template'],
    });

    if (!step) {
      this.logger.warn(
        `Drip step ${stepNumber} not found for sequence ${enrollment.sequenceId}`,
      );
      return;
    }

    const contact = enrollment.contact;
    if (contact.optedOut) {
      enrollment.status = EnrollStatus.UNSUBSCRIBED;
      await this.enrollmentRepository.save(enrollment);
      return;
    }

    // Check step condition
    if (step.condition === StepCondition.NO_REPLY) {
      const hasReply = await this.messageLogRepository.count({
        where: {
          contactId: contact.id,
          direction: Direction.INBOUND,
        },
      });
      if (hasReply > 0) {
        this.logger.debug(
          `Skipping step ${stepNumber}: contact replied (NO_REPLY condition)`,
        );
        await this.advanceToNextStep(enrollment, step);
        return;
      }
    }

    if (step.condition === StepCondition.REPLIED) {
      const hasReply = await this.messageLogRepository.count({
        where: {
          contactId: contact.id,
          direction: Direction.INBOUND,
        },
      });
      if (hasReply === 0) {
        this.logger.debug(
          `Skipping step ${stepNumber}: contact hasn't replied (REPLIED condition)`,
        );
        await this.advanceToNextStep(enrollment, step);
        return;
      }
    }

    // Resolve template and send
    const template = step.template ??
      await this.templateRepository.findOne({ where: { id: step.templateId } });

    if (!template) {
      this.logger.warn(`Template ${step.templateId} not found`);
      return;
    }

    const resolvedBody = this.variableEngine.resolve(template.body, contact);
    const phone = contact.phone;

    try {
      const res = await fetch(
        `${this.sessionManagerUrl}/sessions/${enrollment.sessionId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            body: resolvedBody,
            mediaUrl: template.mediaUrl,
            mediaType: template.mediaType,
          }),
        },
      );

      if (res.ok) {
        const result = await res.json();
        await this.messageLogRepository.save(
          this.messageLogRepository.create({
            userId: enrollment.sequence?.userId ?? '',
            contactId: contact.id,
            waMessageId: result.waMessageId,
            direction: Direction.OUTBOUND,
            body: resolvedBody,
            status: MessageStatus.SENT,
            sentAt: new Date(),
          }),
        );
      }
    } catch (err) {
      this.logger.error(
        `Drip send failed: ${(err as Error).message}`,
      );
    }

    // Advance to next step
    await this.advanceToNextStep(enrollment, step);
  }

  private async advanceToNextStep(
    enrollment: DripEnrollment,
    currentStep: DripStep,
  ): Promise<void> {
    const nextStep = await this.stepRepository.findOne({
      where: {
        sequenceId: enrollment.sequenceId,
        stepNumber: currentStep.stepNumber + 1,
      },
    });

    if (!nextStep) {
      // Sequence complete
      enrollment.status = EnrollStatus.COMPLETED;
      enrollment.completedAt = new Date();
      await this.enrollmentRepository.save(enrollment);
      return;
    }

    enrollment.currentStep = nextStep.stepNumber;
    await this.enrollmentRepository.save(enrollment);

    // Schedule next step
    await this.dripQueue.add(
      'process-drip-step',
      {
        enrollmentId: enrollment.id,
        stepNumber: nextStep.stepNumber,
      },
      {
        delay: nextStep.delayHours * 3600000,
        jobId: `drip-${enrollment.id}-step-${nextStep.stepNumber}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
