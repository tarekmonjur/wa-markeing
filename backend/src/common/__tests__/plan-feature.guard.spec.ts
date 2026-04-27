import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanFeatureGuard } from '../guards/plan-feature.guard';
import { Plan } from '../../database/enums';

describe('PlanFeatureGuard', () => {
  let guard: PlanFeatureGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PlanFeatureGuard(reflector);
  });

  function mockContext(
    plan: Plan,
    feature: string | undefined,
    planUsage: Record<string, number> = {},
  ): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(feature);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { plan },
          planUsage,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows action when feature flag is true on user plan', () => {
    const ctx = mockContext(Plan.STARTER, 'canUseDrip');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks action when feature flag is false on user plan', () => {
    const ctx = mockContext(Plan.FREE, 'canUseDrip');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('blocks action when numeric limit reached', () => {
    const ctx = mockContext(Plan.FREE, 'maxContacts', { maxContacts: 500 });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows unlimited (-1) numeric feature without usage check', () => {
    const ctx = mockContext(Plan.AGENCY, 'maxContacts', { maxContacts: 99999 });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when no @PlanFeature decorator is present on handler', () => {
    const ctx = mockContext(Plan.FREE, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows PRO user to use API', () => {
    const ctx = mockContext(Plan.PRO, 'canUseApi');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks FREE user from using API', () => {
    const ctx = mockContext(Plan.FREE, 'canUseApi');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows when usage is below numeric limit', () => {
    const ctx = mockContext(Plan.FREE, 'maxContacts', { maxContacts: 499 });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
