import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn,
  JoinTable,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ContactGroup } from './contact-group.entity';
import { MessageLog } from '../../analytics/entities/message-log.entity';

@Entity('contacts')
@Unique(['userId', 'phone'])
@Index(['userId'])
@Index(['phone'])
@Index(['userId', 'optedOut'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ type: 'jsonb', default: {} })
  customFields: Record<string, unknown>;

  @Column({ default: false })
  optedOut: boolean;

  @Column({ nullable: true })
  optedOutAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => User, (u) => u.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToMany(() => ContactGroup, (g) => g.contacts)
  @JoinTable({
    name: 'contact_group_members',
    joinColumn: { name: 'contactId' },
    inverseJoinColumn: { name: 'groupId' },
  })
  groups: ContactGroup[];

  @OneToMany(() => MessageLog, (l) => l.contact)
  messageLogs: MessageLog[];
}
