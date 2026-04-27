import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_FEATURE_KEY } from '../decorators/plan-feature.decorator';
import { PLANS, PlanConfig } from '../../config/plans.config';
import { Plan } from '../../database/enums';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<keyof PlanConfig>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const plan = PLANS[user.plan as Plan];
    if (!plan) return false;

    const value = plan[feature];

    if (typeof value === 'boolean') {
      if (!value) {
        throw new ForbiddenException({
          statusCode: 403,
          message: `Your ${user.plan} plan does not include this feature. Please upgrade.`,
          error: 'PLAN_FEATURE_RESTRICTED',
        });
      }
      return true;
    }

    if (typeof value === 'number') {
      // -1 means unlimited
      if (value === -1) return true;

      const usage = request.planUsage?.[feature] ?? 0;
      if (usage >= value) {
        throw new ForbiddenException({
          statusCode: 403,
          message: `Plan limit reached for ${feature}. Current: ${usage}/${value}. Please upgrade.`,
          error: 'PLAN_LIMIT_EXCEEDED',
        });
      }
      return true;
    }

    return true;
  }
}
