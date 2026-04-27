import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Campaign } from './campaign.entity';
import { AbResult } from './ab-result.entity';

export enum AbStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('ab_tests')
export class AbTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  campaignId: string;

  @Column()
  variantA: string;

  @Column()
  variantB: string;

  @Column({ type: 'float', default: 0.5 })
  splitRatio: number;

  @Column({ nullable: true })
  winnerId?: string;

  @Column({ type: 'enum', enum: AbStatus, default: AbStatus.RUNNING })
  status: AbStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @OneToOne(() => Campaign)
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @OneToMany(() => AbResult, (r) => r.abTest, { cascade: true })
  results: AbResult[];
}
