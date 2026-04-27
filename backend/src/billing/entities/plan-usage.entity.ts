import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('plan_usages')
export class PlanUsage {
  @PrimaryColumn()
  userId: string;

  @Column({ default: 0 })
  contactCount: number;

  @Column({ default: 0 })
  sessionsCount: number;

  @Column({ default: 0 })
  campaignsThisMonth: number;

  @Column({ default: 0 })
  messagesToday: number;

  @Column({ default: 0 })
  aiGenerationsToday: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  lastDailyResetAt: Date;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  lastMonthlyResetAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
