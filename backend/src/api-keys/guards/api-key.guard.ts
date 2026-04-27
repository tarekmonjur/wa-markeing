import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators';
import { ApiKeyService } from '../api-key.service';

/**
 * Guard that authenticates via API key (Authorization: Bearer wam_... or X-API-Key header).
 * Falls through to let JwtAuthGuard handle if no API key is present.
 * NEVER accepts API key via query parameter (security: would leak to server logs).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();

    // Already authenticated by JWT
    if (request.user) return true;

    const apiKey = this.extractApiKey(request);
    if (!apiKey) return true; // Let JwtAuthGuard handle

    const user = await this.apiKeyService.validateApiKey(apiKey);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    request.user = user;
    request.isApiKeyAuth = true;
    return true;
  }

  private extractApiKey(request: any): string | null {
    // Check X-API-Key header first
    const xApiKey = request.headers['x-api-key'];
    if (xApiKey && typeof xApiKey === 'string' && xApiKey.startsWith('wam_')) {
      return xApiKey;
    }

    // Check Authorization: Bearer wam_...
    const authHeader = request.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
      const [scheme, token] = authHeader.split(' ');
      if (
        scheme?.toLowerCase() === 'bearer' &&
        token?.startsWith('wam_')
      ) {
        return token;
      }
    }

    return null;
  }
}
