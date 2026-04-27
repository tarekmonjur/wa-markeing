import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repo: Repository<NotificationPreference>,
  ) {}

  async getOrCreate(userId: string): Promise<NotificationPreference> {
    let prefs = await this.repo.findOne({ where: { userId } });
    if (!prefs) {
      prefs = this.repo.create({ userId });
      prefs = await this.repo.save(prefs);
    }
    return prefs;
  }

  async update(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    const prefs = await this.getOrCreate(userId);
    Object.assign(prefs, dto);
    return this.repo.save(prefs);
  }

  async shouldNotify(
    userId: string,
    type: 'campaignCompleted' | 'sessionDisconnected' | 'tosBlockAlert' | 'webhookAbandoned' | 'dailySummary',
  ): Promise<boolean> {
    const prefs = await this.getOrCreate(userId);
    return prefs[type];
  }
}
