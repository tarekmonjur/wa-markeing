import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { DripSequence } from './drip-sequence.entity';
import { Contact } from '../../contacts/entities/contact.entity';

export enum EnrollStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
}

@Entity('drip_enrollments')
@Unique(['sequenceId', 'contactId'])
@Index(['sequenceId', 'status'])
export class DripEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sequenceId: string;

  @Column()
  contactId: string;

  @Column()
  sessionId: string;

  @Column({ default: 1 })
  currentStep: number;

  @Column({
    type: 'enum',
    enum: EnrollStatus,
    default: EnrollStatus.ACTIVE,
  })
  status: EnrollStatus;

  @CreateDateColumn()
  enrolledAt: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @ManyToOne(() => DripSequence, (s) => s.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sequenceId' })
  sequence: DripSequence;

  @ManyToOne(() => Contact)
  @JoinColumn({ name: 'contactId' })
  contact: Contact;
}
