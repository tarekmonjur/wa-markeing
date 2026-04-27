import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WebhookEndpoint } from './webhook-endpoint.entity';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  ABANDONED = 'ABANDONED',
}

@Entity('webhook_deliveries')
@Index(['endpointId', 'status'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  endpointId: string;

  @Column()
  event: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  status: DeliveryStatus;

  @Column({ nullable: true })
  responseCode?: number;

  @Column({ type: 'text', nullable: true })
  responseBody?: string;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ nullable: true })
  nextRetryAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  deliveredAt?: Date;

  @ManyToOne(() => WebhookEndpoint, (e) => e.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpointId' })
  endpoint: WebhookEndpoint;
}
