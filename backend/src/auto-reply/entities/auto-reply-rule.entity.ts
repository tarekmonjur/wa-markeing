import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MatchType {
  EXACT = 'EXACT',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  REGEX = 'REGEX',
}

@Entity('auto_reply_rules')
@Index(['userId', 'isActive'])
export class AutoReplyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  sessionId?: string;

  @Column()
  keyword: string;

  @Column({ type: 'enum', enum: MatchType, default: MatchType.CONTAINS })
  matchType: MatchType;

  @Column('text')
  replyBody: string;

  @Column({ nullable: true })
  mediaUrl?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
