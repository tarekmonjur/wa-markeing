import { SetMetadata } from '@nestjs/common';
import { PlanConfig } from '../../config/plans.config';

export const PLAN_FEATURE_KEY = 'planFeature';
export const PlanFeature = (feature: keyof PlanConfig) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);
