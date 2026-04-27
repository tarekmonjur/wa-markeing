import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { DailyStats } from '../analytics/entities/daily-stats.entity';

export type HealthLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface AccountHealth {
  sessionId: string;
  score: number;
  level: HealthLevel;
  deliveryRate: number;
  failRate: number;
  replyRate: number;
}

@Injectable()
export class AccountHealthService {
  constructor(
    @InjectRepository(DailyStats)
    private readonly dailyRepo: Repository<DailyStats>,
  ) {}

  async computeHealth(sessionId: string): Promise<AccountHealth> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().slice(0, 10);

    const stats = await this.dailyRepo.find({
      where: {
        sessionId,
        date: MoreThanOrEqual(dateStr),
      },
    });

    const totals = stats.reduce(
      (acc, s) => ({
        sent: acc.sent + s.sentCount,
        delivered: acc.delivered + s.deliveredCount,
        read: acc.read + s.readCount,
        failed: acc.failed + s.failedCount,
      }),
      { sent: 0, delivered: 0, read: 0, failed: 0 },
    );

    const deliveryRate = totals.sent > 0 ? totals.delivered / totals.sent : 1;
    const failRate = totals.sent > 0 ? totals.failed / totals.sent : 0;
    const replyRate = totals.delivered > 0 ? totals.read / totals.delivered : 0;

    // Score: deliveryRate(40%) + (1-failRate)(30%) + replyRate(20%) + base(10%)
    const score = Math.round(
      deliveryRate * 40 + (1 - failRate) * 30 + replyRate * 20 + 10,
    );

    const clampedScore = Math.max(0, Math.min(100, score));

    let level: HealthLevel;
    if (clampedScore >= 80) level = 'GREEN';
    else if (clampedScore >= 50) level = 'YELLOW';
    else level = 'RED';

    return {
      sessionId,
      score: clampedScore,
      level,
      deliveryRate: Math.round(deliveryRate * 100),
      failRate: Math.round(failRate * 100),
      replyRate: Math.round(replyRate * 100),
    };
  }

  async computeHealthForUser(userId: string, sessionIds: string[]): Promise<AccountHealth[]> {
    return Promise.all(sessionIds.map((id) => this.computeHealth(id)));
  }
}
