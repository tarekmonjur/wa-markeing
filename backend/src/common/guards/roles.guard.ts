import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../teams/entities/team-member.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no @Roles() decorator = any authenticated user
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    // Owner (the original user) always has ADMIN access
    const userRole = user.role ?? UserRole.ADMIN;
    return requiredRoles.includes(userRole);
  }
}
