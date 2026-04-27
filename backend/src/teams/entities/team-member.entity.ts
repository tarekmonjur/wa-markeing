import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum UserRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

@Entity('team_members')
@Index(['teamId'])
export class TeamMember {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  teamId: string; // The owner user's ID acts as the team ID

  @Column({ type: 'enum', enum: UserRole, default: UserRole.AGENT })
  role: UserRole;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
