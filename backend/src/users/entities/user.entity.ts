import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Plan } from '../../database/enums';
import { WaSession } from '../../whatsapp/entities/wa-session.entity';
import { Contact } from '../../contacts/entities/contact.entity';
import { ContactGroup } from '../../contacts/entities/contact-group.entity';
import { Template } from '../../templates/entities/template.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { MessageLog } from '../../analytics/entities/message-log.entity';

@Entity('users')
@Index(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: 'enum', enum: Plan, default: Plan.FREE })
  plan: Plan;

  @Column({ nullable: true })
  refreshTokenHash: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @OneToMany(() => WaSession, (s) => s.user)
  waSessions: WaSession[];

  @OneToMany(() => Contact, (c) => c.user)
  contacts: Contact[];

  @OneToMany(() => ContactGroup, (g) => g.user)
  contactGroups: ContactGroup[];

  @OneToMany(() => Template, (t) => t.user)
  templates: Template[];

  @OneToMany(() => Campaign, (c) => c.user)
  campaigns: Campaign[];

  @OneToMany(() => MessageLog, (l) => l.user)
  messageLogs: MessageLog[];
}
