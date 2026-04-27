import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ default: true })
  campaignCompleted: boolean;

  @Column({ default: true })
  sessionDisconnected: boolean;

  @Column({ default: true })
  tosBlockAlert: boolean;

  @Column({ default: true })
  webhookAbandoned: boolean;

  @Column({ default: false })
  dailySummary: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
