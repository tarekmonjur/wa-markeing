import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AbTest } from './ab-test.entity';

@Entity('ab_results')
export class AbResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  abTestId: string;

  @Column()
  variant: string; // 'A' or 'B'

  @Column({ default: 0 })
  sent: number;

  @Column({ default: 0 })
  delivered: number;

  @Column({ default: 0 })
  read: number;

  @Column({ default: 0 })
  replied: number;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => AbTest, (t) => t.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'abTestId' })
  abTest: AbTest;
}
