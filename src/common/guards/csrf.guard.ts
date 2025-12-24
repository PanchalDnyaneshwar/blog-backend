import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

/**
 * CSRF Protection Guard
 * 
 * For REST APIs with JWT tokens, we use multiple layers:
 * 1. SameSite: 'strict' cookies (already implemented)
 * 2. CORS with credentials (already implemented)
 * 3. Custom header requirement (this guard)
 * 
 * The custom header requirement prevents CSRF because:
 * - Browsers enforce CORS for custom headers
 * - Attackers cannot set custom headers from other origins
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if CSRF is skipped for this route
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCsrf) {
      return true;
    }

    // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Skip CSRF for auth endpoints (they have their own security)
    if (request.path.startsWith('/api/auth')) {
      return true;
    }

    // Require custom header for state-changing operations
    // This prevents CSRF because browsers enforce CORS for custom headers
    const customHeader = request.headers['x-requested-with'] || request.headers['x-csrf-token'];
    
    if (!customHeader) {
      throw new ForbiddenException(
        'CSRF protection: Custom header required. Include X-Requested-With or X-CSRF-Token header.'
      );
    }

    return true;
  }
}

