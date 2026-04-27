import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { CampaignStatus } from '../../database/enums';
import { User } from '../../users/entities/user.entity';
import { WaSession } from '../../whatsapp/entities/wa-session.entity';
import { Template } from '../../templates/entities/template.entity';
import { ContactGroup } from '../../contacts/entities/contact-group.entity';
import { MessageLog } from '../../analytics/entities/message-log.entity';

@Entity('campaigns')
@Index(['userId'])
@Index(['status'])
@Index(['scheduledAt'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  sessionId: string;

  @Column({ nullable: true })
  templateId?: string;

  @Column({ nullable: true })
  groupId?: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly';
    daysOfWeek?: number[];   // 0=Sun, 6=Sat (for weekly)
    dayOfMonth?: number;     // 1–28 (for monthly)
    endDate?: string;        // ISO date, optional
  };

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ default: 0 })
  totalContacts: number;

  @Column({ default: 0 })
  sentCount: number;

  @Column({ default: 0 })
  deliveredCount: number;

  @Column({ default: 0 })
  failedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.campaigns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => WaSession, (s) => s.campaigns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: WaSession;

  @ManyToOne(() => Template, (t) => t.campaigns, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template?: Template;

  @ManyToOne(() => ContactGroup, (g) => g.campaigns, { nullable: true })
  @JoinColumn({ name: 'groupId' })
  group?: ContactGroup;

  @OneToMany(() => MessageLog, (l) => l.campaign)
  messageLogs: MessageLog[];
}
