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
import { SessionStatus } from '../../database/enums';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Entity('wa_sessions')
@Index(['userId'])
@Index(['status'])
export class WaSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.DISCONNECTED })
  status: SessionStatus;

  @Column({ type: 'jsonb', nullable: true })
  sessionData?: Record<string, unknown>;

  @Column({ nullable: true })
  lastSeenAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.waSessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Campaign, (c) => c.session)
  campaigns: Campaign[];
}
