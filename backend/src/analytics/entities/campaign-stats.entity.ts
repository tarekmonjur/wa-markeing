import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Entity('campaign_stats')
export class CampaignStats {
  @PrimaryColumn()
  campaignId: string;

  @Column({ default: 0 })
  totalContacts: number;

  @Column({ default: 0 })
  sentCount: number;

  @Column({ default: 0 })
  deliveredCount: number;

  @Column({ default: 0 })
  readCount: number;

  @Column({ default: 0 })
  failedCount: number;

  @Column({ default: 0 })
  repliedCount: number;

  @Column({ default: 0 })
  optedOutCount: number;

  @Column({ type: 'float', default: 0 })
  deliveryRate: number;

  @Column({ type: 'float', default: 0 })
  readRate: number;

  @Column({ type: 'float', default: 0 })
  replyRate: number;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Campaign)
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;
}
