import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
  ) {}

  async getOrCreate(userId: string): Promise<UserSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });
    if (!settings) {
      settings = this.settingsRepo.create({ userId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async update(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<UserSettings> {
    let settings = await this.getOrCreate(userId);
    Object.assign(settings, dto);
    settings = await this.settingsRepo.save(settings);
    return settings;
  }

  /**
   * Calculate milliseconds until the next send window opens.
   * Returns 0 if currently within the window.
   * Returns -1 if smart send is disabled (always allow).
   */
  async getMsUntilNextWindow(userId: string): Promise<number> {
    const settings = await this.getOrCreate(userId);
    if (!settings.smartSendEnabled) return -1;

    const now = new Date();
    // Convert to user's timezone
    const userNow = new Date(
      now.toLocaleString('en-US', { timeZone: settings.timezone }),
    );
    const hour = userNow.getHours();
    // JavaScript: 0=Sunday, convert to 1=Monday..7=Sunday
    const jsDay = userNow.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const isInWindow =
      settings.sendDaysOfWeek.includes(dayOfWeek) &&
      hour >= settings.sendWindowStart &&
      hour < settings.sendWindowEnd;

    if (isInWindow) return 0;

    // Calculate next window opening
    return this.calculateNextWindowMs(settings, now);
  }

  private calculateNextWindowMs(
    settings: UserSettings,
    now: Date,
  ): number {
    const userNow = new Date(
      now.toLocaleString('en-US', { timeZone: settings.timezone }),
    );

    // Try today first if window hasn't opened yet
    const jsDay = userNow.getDay();
    const currentDay = jsDay === 0 ? 7 : jsDay;
    const currentHour = userNow.getHours();

    if (
      settings.sendDaysOfWeek.includes(currentDay) &&
      currentHour < settings.sendWindowStart
    ) {
      // Window opens later today
      const hoursUntil = settings.sendWindowStart - currentHour;
      const minuteOffset = userNow.getMinutes();
      return (hoursUntil * 60 - minuteOffset) * 60 * 1000;
    }

    // Find the next allowed day
    const sortedDays = [...settings.sendDaysOfWeek].sort((a, b) => a - b);
    let nextDay: number | null = null;
    let daysAhead = 0;

    for (let i = 1; i <= 7; i++) {
      const candidateDay = ((currentDay - 1 + i) % 7) + 1;
      if (sortedDays.includes(candidateDay)) {
        nextDay = candidateDay;
        daysAhead = i;
        break;
      }
    }

    if (nextDay === null) return 0; // No send days configured

    const msPerDay = 24 * 60 * 60 * 1000;
    const nextWindowDate = new Date(userNow);
    nextWindowDate.setDate(nextWindowDate.getDate() + daysAhead);
    nextWindowDate.setHours(settings.sendWindowStart, 0, 0, 0);

    return Math.max(0, nextWindowDate.getTime() - userNow.getTime());
  }
}
