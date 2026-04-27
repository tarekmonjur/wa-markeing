import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  /**
   * Create a new API key. Returns the raw key ONCE — it cannot be retrieved again.
   */
  async create(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ key: string; id: string; keyPrefix: string }> {
    const rawKey = `wam_${randomBytes(32).toString('base64url')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepo.create({
      userId,
      name: dto.name,
      keyHash,
      keyPrefix,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    const saved = await this.apiKeyRepo.save(apiKey);

    return { key: rawKey, id: saved.id, keyPrefix };
  }

  /**
   * Validate an API key and return the associated user.
   * Returns null if key is invalid, inactive, or expired.
   */
  async validateApiKey(rawKey: string): Promise<User | null> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const record = await this.apiKeyRepo.findOne({
      where: { keyHash },
      relations: ['user'],
    });

    if (!record || !record.isActive) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Update lastUsedAt (non-blocking)
    this.apiKeyRepo
      .update(record.id, { lastUsedAt: new Date() })
      .catch(() => {});

    return record.user;
  }

  async findAllByUser(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'name',
        'keyPrefix',
        'lastUsedAt',
        'expiresAt',
        'isActive',
        'createdAt',
      ],
    });
  }

  async revoke(userId: string, id: string): Promise<void> {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { id, userId },
    });
    if (!apiKey) throw new NotFoundException('API key not found');

    apiKey.isActive = false;
    await this.apiKeyRepo.save(apiKey);
  }

  async delete(userId: string, id: string): Promise<void> {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { id, userId },
    });
    if (!apiKey) throw new NotFoundException('API key not found');

    await this.apiKeyRepo.remove(apiKey);
  }
}
