import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Client as MinioClient } from 'minio';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import { format as csvFormat } from 'fast-csv';
import { ExportJob, ExportStatus, ExportFormat } from './entities/export-job.entity';
import { MessageLog } from './entities/message-log.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

interface ExportPayload {
  exportJobId: string;
  campaignId: string;
  format: string;
  userId: string;
}

@Processor('export')
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);
  private readonly minio: MinioClient;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(ExportJob)
    private readonly exportRepo: Repository<ExportJob>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepo: Repository<MessageLog>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    private readonly config: ConfigService,
  ) {
    super();
    this.minio = new MinioClient({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'minio'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: this.config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucketName = this.config.get<string>('MINIO_BUCKET', 'wa-media');
  }

  async process(job: Job<ExportPayload>): Promise<void> {
    const { exportJobId, campaignId, format } = job.data;

    await this.exportRepo.update(exportJobId, { status: ExportStatus.PROCESSING });

    try {
      const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
      const logs = await this.messageLogRepo.find({
        where: { campaignId },
        relations: ['contact'],
        order: { createdAt: 'ASC' },
      });

      let buffer: Buffer;
      let filename: string;
      let contentType: string;

      if (format === ExportFormat.CSV) {
        buffer = await this.generateCsv(campaign, logs);
        filename = `exports/${exportJobId}.csv`;
        contentType = 'text/csv';
      } else {
        buffer = await this.generatePdf(campaign, logs);
        filename = `exports/${exportJobId}.pdf`;
        contentType = 'application/pdf';
      }

      await this.minio.putObject(this.bucketName, filename, buffer, buffer.length, {
        'Content-Type': contentType,
      });

      const downloadUrl = await this.minio.presignedGetObject(
        this.bucketName,
        filename,
        24 * 60 * 60, // 24 hours expiry
      );

      // Replace internal minio hostname with localhost for dev access
      const publicUrl = downloadUrl.replace('minio:', 'localhost:');

      await this.exportRepo.update(exportJobId, {
        status: ExportStatus.COMPLETE,
        downloadUrl: publicUrl,
      });

      this.logger.log(`Export ${exportJobId} completed`);
    } catch (err) {
      this.logger.error(`Export ${exportJobId} failed: ${err}`);
      await this.exportRepo.update(exportJobId, {
        status: ExportStatus.FAILED,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  private async generateCsv(campaign: Campaign | null, logs: MessageLog[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = csvFormat({ headers: true });

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);

      for (const log of logs) {
        stream.write({
          'Contact Name': log.contact?.name ?? '',
          'Phone': log.contact?.phone ?? '',
          'Status': log.status,
          'Sent At': log.sentAt?.toISOString() ?? '',
          'Delivered At': log.deliveredAt?.toISOString() ?? '',
          'Read At': log.readAt?.toISOString() ?? '',
          'Fail Reason': log.failReason ?? '',
          'Message': log.body ?? '',
        });
      }
      stream.end();
    });
  }

  private async generatePdf(campaign: Campaign | null, logs: MessageLog[]): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Title
      doc
        .fontSize(18)
        .text(`Campaign Report: ${campaign?.name ?? 'Unknown'}`, { align: 'center' });
      doc.moveDown();

      // Summary
      doc.fontSize(12);
      doc.text(`Total Contacts: ${campaign?.totalContacts ?? 0}`);
      doc.text(`Sent: ${campaign?.sentCount ?? 0}`);
      doc.text(`Delivered: ${campaign?.deliveredCount ?? 0}`);
      doc.text(`Failed: ${campaign?.failedCount ?? 0}`);
      doc.text(`Status: ${campaign?.status ?? 'N/A'}`);
      doc.moveDown();

      // Message details
      doc.fontSize(14).text('Message Details', { underline: true });
      doc.moveDown(0.5);

      for (const log of logs) {
        doc.fontSize(10);
        doc.text(
          `${log.contact?.name ?? 'Unknown'} (${log.contact?.phone ?? ''}) — ${log.status}${log.failReason ? ` [${log.failReason}]` : ''}`,
        );
      }

      doc.end();
    });
  }
}
