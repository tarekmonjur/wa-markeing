import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { BillingService } from './billing.service';

/**
 * Attaches planUsage to request for PlanFeatureGuard to read.
 * Only runs when user is authenticated (user attached by Passport).
 */
@Injectable()
export class PlanUsageMiddleware implements NestMiddleware {
  constructor(private readonly billingService: BillingService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    if (user?.id) {
      (req as any).planUsage = await this.billingService.getUsageForGuard(
        user.id,
      );
    }
    next();
  }
}
