import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn()
  userId: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 9 })
  sendWindowStart: number;

  @Column({ default: 18 })
  sendWindowEnd: number;

  @Column('simple-array', { default: '1,2,3,4,5' })
  sendDaysOfWeek: number[];

  @Column({ default: false })
  smartSendEnabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
