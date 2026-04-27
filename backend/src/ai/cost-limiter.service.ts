import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAiProvider } from './interfaces/ai-provider.interface';

/**
 * Cost limiter with Redis-like quota tracking via in-memory map.
 * For production, replace with Redis INCR + EXPIREAT.
 */
@Injectable()
export class CostLimiterService {
  private readonly logger = new Logger(CostLimiterService.name);
  private readonly quotas: Map<string, { count: number; date: string }> = new Map();

  private readonly limits = {
    FREE: 10,
    STARTER: 50,
    PRO: 100,
    AGENCY: 500,
  };

  getLimit(plan: string): number {
    return this.limits[plan as keyof typeof this.limits] ?? 10;
  }

  checkQuota(userId: string, plan: string): { allowed: boolean; remaining: number } {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${today}`;
    const current = this.quotas.get(key);
    const limit = this.getLimit(plan);

    if (!current || current.date !== today) {
      return { allowed: true, remaining: limit };
    }

    return {
      allowed: current.count < limit,
      remaining: Math.max(0, limit - current.count),
    };
  }

  recordUsage(userId: string): void {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${today}`;
    const current = this.quotas.get(key);

    if (!current || current.date !== today) {
      this.quotas.set(key, { count: 1, date: today });
    } else {
      current.count++;
    }
  }
}
