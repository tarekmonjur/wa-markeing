import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

export enum ExportFormat {
  CSV = 'CSV',
  PDF = 'PDF',
}

@Entity('export_jobs')
@Index(['userId'])
export class ExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  campaignId: string;

  @Column({ type: 'enum', enum: ExportFormat })
  format: ExportFormat;

  @Column({ type: 'enum', enum: ExportStatus, default: ExportStatus.PENDING })
  status: ExportStatus;

  @Column({ nullable: true })
  downloadUrl?: string;

  @Column({ nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt: Date;
}
