import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
} from 'typeorm';

@Entity('daily_stats')
@Unique(['userId', 'sessionId', 'date'])
@Index(['userId', 'date'])
export class DailyStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  sessionId?: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ default: 0 })
  sentCount: number;

  @Column({ default: 0 })
  deliveredCount: number;

  @Column({ default: 0 })
  readCount: number;

  @Column({ default: 0 })
  failedCount: number;
}
