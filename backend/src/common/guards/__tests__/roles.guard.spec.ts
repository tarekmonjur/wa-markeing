import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { UserRole } from '../../../teams/entities/team-member.entity';
import { ROLES_KEY } from '../../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (user: Record<string, unknown> | null): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows any authenticated user when no @Roles() decorator present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ id: 'u1', role: UserRole.VIEWER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows ADMIN on admin-only endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ id: 'u1', role: UserRole.ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks VIEWER on ADMIN-only endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ id: 'u1', role: UserRole.VIEWER });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('blocks AGENT on ADMIN-only endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ id: 'u1', role: UserRole.AGENT });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows AGENT on endpoint requiring ADMIN or AGENT', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.ADMIN,
      UserRole.AGENT,
    ]);
    const context = createMockContext({ id: 'u1', role: UserRole.AGENT });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks when no user on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext(null);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('owner without role defaults to ADMIN (allows access)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    // User without explicit role — defaults to ADMIN via the ?? operator in guard
    const context = createMockContext({ id: 'u1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows empty roles array (same as no decorator)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = createMockContext({ id: 'u1', role: UserRole.VIEWER });

    expect(guard.canActivate(context)).toBe(true);
  });
});
