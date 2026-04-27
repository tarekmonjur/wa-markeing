import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { BillingService } from './billing.service';
import { PLANS } from '../config/plans.config';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('usage')
  async getUsage(@CurrentUser() user: User) {
    const usage = await this.billingService.getOrCreateUsage(user.id);
    const planConfig = PLANS[user.plan];
    return {
      plan: user.plan,
      limits: planConfig,
      usage: {
        contactCount: usage.contactCount,
        sessionsCount: usage.sessionsCount,
        campaignsThisMonth: usage.campaignsThisMonth,
        messagesToday: usage.messagesToday,
        aiGenerationsToday: usage.aiGenerationsToday,
      },
    };
  }
}
