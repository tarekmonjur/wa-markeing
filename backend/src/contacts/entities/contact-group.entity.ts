import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Contact } from './contact.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Entity('contact_groups')
@Index(['userId'])
export class ContactGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.contactGroups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToMany(() => Contact, (c) => c.groups)
  contacts: Contact[];

  @OneToMany(() => Campaign, (c) => c.group)
  campaigns: Campaign[];
}
