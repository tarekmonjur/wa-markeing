import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Token-bucket rate limiter per session, backed by in-memory Maps.
 * For production, replace with Redis-backed implementation.
 *
 * SRP: Only concerned with rate limiting logic.
 * OCP: New limiting strategies can extend this class.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // Minimum floor: 2000ms between sends (non-negotiable per instructions)
  private readonly MIN_DELAY_MS = 2000;
  private readonly DEFAULT_DELAY_MS = 3000;
  private readonly DEFAULT_DAILY_CAP = 200;

  // In-memory tracking (replace with Redis for multi-instance)
  private readonly lastSendTime = new Map<string, number>();
  private readonly dailyCounts = new Map<string, { count: number; date: string }>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if a message can be sent for a given session.
   * Returns the delay in ms to wait before sending.
   * Returns -1 if the daily cap is exceeded.
   */
  async acquireToken(sessionId: string): Promise<number> {
    // Check daily cap
    if (this.isDailyCapExceeded(sessionId)) {
      this.logger.warn(`Daily cap exceeded for session ${sessionId}`);
      return -1;
    }

    const now = Date.now();
    const lastSent = this.lastSendTime.get(sessionId) ?? 0;
    const elapsed = now - lastSent;

    const requiredDelay = Math.max(this.MIN_DELAY_MS, this.DEFAULT_DELAY_MS);

    if (elapsed >= requiredDelay) {
      this.recordSend(sessionId);
      return 0;
    }

    const waitTime = requiredDelay - elapsed;
    return waitTime;
  }

  /**
   * Record that a message was sent for a session.
   * Must be called after actually sending.
   */
  recordSend(sessionId: string): void {
    this.lastSendTime.set(sessionId, Date.now());
    this.incrementDailyCount(sessionId);
  }

  getDailyCount(sessionId: string): number {
    const today = this.todayUtc();
    const entry = this.dailyCounts.get(sessionId);

    if (!entry || entry.date !== today) {
      return 0;
    }

    return entry.count;
  }

  getDailyCap(): number {
    return this.DEFAULT_DAILY_CAP;
  }

  private isDailyCapExceeded(sessionId: string): boolean {
    return this.getDailyCount(sessionId) >= this.DEFAULT_DAILY_CAP;
  }

  private incrementDailyCount(sessionId: string): void {
    const today = this.todayUtc();
    const entry = this.dailyCounts.get(sessionId);

    if (!entry || entry.date !== today) {
      this.dailyCounts.set(sessionId, { count: 1, date: today });
    } else {
      entry.count++;
    }
  }

  private todayUtc(): string {
    return new Date().toISOString().substring(0, 10);
  }
}
