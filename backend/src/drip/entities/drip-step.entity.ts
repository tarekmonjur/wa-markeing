import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DripSequence } from './drip-sequence.entity';
import { Template } from '../../templates/entities/template.entity';

export enum StepCondition {
  ALWAYS = 'ALWAYS',
  NO_REPLY = 'NO_REPLY',
  REPLIED = 'REPLIED',
}

@Entity('drip_steps')
@Index(['sequenceId', 'stepNumber'])
export class DripStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sequenceId: string;

  @Column()
  stepNumber: number;

  @Column()
  templateId: string;

  @Column()
  delayHours: number;

  @Column({
    type: 'enum',
    enum: StepCondition,
    default: StepCondition.ALWAYS,
  })
  condition: StepCondition;

  @ManyToOne(() => DripSequence, (s) => s.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sequenceId' })
  sequence: DripSequence;

  @ManyToOne(() => Template)
  @JoinColumn({ name: 'templateId' })
  template: Template;
}
