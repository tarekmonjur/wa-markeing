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
import { MessageStatus, Direction } from '../../database/enums';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Contact } from '../../contacts/entities/contact.entity';

@Entity('message_logs')
@Index(['userId'])
@Index(['campaignId'])
@Index(['contactId'])
@Index(['status'])
@Index(['waMessageId'])
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column()
  contactId: string;

  @Column({ nullable: true })
  waMessageId?: string;

  @Column({ type: 'enum', enum: Direction, default: Direction.OUTBOUND })
  direction: Direction;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ nullable: true })
  mediaUrl?: string;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.PENDING })
  status: MessageStatus;

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ nullable: true })
  deliveredAt?: Date;

  @Column({ nullable: true })
  readAt?: Date;

  @Column({ nullable: true })
  failReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.messageLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Campaign, (c) => c.messageLogs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campaignId' })
  campaign?: Campaign;

  @ManyToOne(() => Contact, (c) => c.messageLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contactId' })
  contact: Contact;
}
