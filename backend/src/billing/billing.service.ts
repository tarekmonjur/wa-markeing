import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { PlanUsage } from './entities/plan-usage.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(PlanUsage)
    private readonly usageRepo: Repository<PlanUsage>,
  ) {}

  async getOrCreateUsage(userId: string): Promise<PlanUsage> {
    let usage = await this.usageRepo.findOne({ where: { userId } });
    if (!usage) {
      usage = this.usageRepo.create({ userId });
      usage = await this.usageRepo.save(usage);
    }
    return this.resetCountersIfNeeded(usage);
  }

  private async resetCountersIfNeeded(usage: PlanUsage): Promise<PlanUsage> {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    let needsSave = false;

    // Reset daily counters
    const lastDaily = new Date(usage.lastDailyResetAt).toISOString().substring(0, 10);
    if (lastDaily !== todayStr) {
      usage.messagesToday = 0;
      usage.aiGenerationsToday = 0;
      usage.lastDailyResetAt = today;
      needsSave = true;
    }

    // Reset monthly counter
    const lastMonthly = new Date(usage.lastMonthlyResetAt);
    if (
      lastMonthly.getMonth() !== today.getMonth() ||
      lastMonthly.getFullYear() !== today.getFullYear()
    ) {
      usage.campaignsThisMonth = 0;
      usage.lastMonthlyResetAt = today;
      needsSave = true;
    }

    if (needsSave) {
      usage = await this.usageRepo.save(usage);
    }

    return usage;
  }

  @OnEvent('contact.created')
  async onContactCreated(payload: { userId: string }) {
    const usage = await this.getOrCreateUsage(payload.userId);
    await this.usageRepo.update(usage.userId, {
      contactCount: usage.contactCount + 1,
    });
  }

  @OnEvent('contact.deleted')
  async onContactDeleted(payload: { userId: string }) {
    const usage = await this.getOrCreateUsage(payload.userId);
    await this.usageRepo.update(usage.userId, {
      contactCount: Math.max(0, usage.contactCount - 1),
    });
  }

  @OnEvent('session.created')
  async onSessionCreated(payload: { userId: string }) {
    const usage = await this.getOrCreateUsage(payload.userId);
    await this.usageRepo.update(usage.userId, {
      sessionsCount: usage.sessionsCount + 1,
    });
  }

  @OnEvent('session.deleted')
  async onSessionDeleted(payload: { userId: string }) {
    const usage = await this.getOrCreateUsage(payload.userId);
    await this.usageRepo.update(usage.userId, {
      sessionsCount: Math.max(0, usage.sessionsCount - 1),
    });
  }

  @OnEvent('campaign.created')
  async onCampaignCreated(payload: { userId: string }) {
    const usage = await this.getOrCreateUsage(payload.userId);
    await this.usageRepo.update(usage.userId, {
      campaignsThisMonth: usage.campaignsThisMonth + 1,
    });
  }

  @OnEvent('message.sent')
  async onMessageSent(payload: { userId: string }) {
    const usage = await this.getOrCreateUsage(payload.userId);
    await this.usageRepo.update(usage.userId, {
      messagesToday: usage.messagesToday + 1,
    });
  }

  @OnEvent('ai.generation')
  async onAiGeneration(payload: { userId: string }) {
    const usage = await this.getOrCreateUsage(payload.userId);
    await this.usageRepo.update(usage.userId, {
      aiGenerationsToday: usage.aiGenerationsToday + 1,
    });
  }

  /**
   * Returns usage mapped to plan config keys for PlanFeatureGuard.
   */
  async getUsageForGuard(userId: string): Promise<Record<string, number>> {
    const usage = await this.getOrCreateUsage(userId);
    return {
      maxContacts: usage.contactCount,
      maxSessions: usage.sessionsCount,
      maxCampaignsPerMonth: usage.campaignsThisMonth,
      maxMessagesPerDay: usage.messagesToday,
      aiGenerationsPerDay: usage.aiGenerationsToday,
    };
  }
}
