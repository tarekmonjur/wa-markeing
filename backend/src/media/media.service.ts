import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
    });
    this.bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'wa-marketing',
    );
  }

  async onModuleInit(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Bucket "${this.bucket}" created`);
    }
  }

  async upload(
    stream: Readable,
    originalName: string,
    mimeType: string,
    size: number,
  ): Promise<{ key: string; url: string }> {
    const ext = originalName.split('.').pop() ?? '';
    const key = `${randomUUID()}.${ext}`;

    await this.client.putObject(this.bucket, key, stream, size, {
      'Content-Type': mimeType,
    });

    const url = await this.getPresignedUrl(key);
    return { key, url };
  }

  async getPresignedUrl(key: string, expiry = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiry);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
