import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';

export const RateLimit = (limit: number, windowSeconds: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('rateLimit', { limit, windowSeconds }, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class RateLimitGuard {
  constructor(
    private redis: RedisService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    
    // Get rate limit metadata
    const rateLimitMeta = Reflect.getMetadata('rateLimit', handler);
    
    if (!rateLimitMeta) {
      return true; // No rate limit set
    }

    const { limit, windowSeconds } = rateLimitMeta;
    
    // Get identifier (IP address or user ID)
    const identifier = this.getIdentifier(request);
    const key = `rate_limit:${handler.name}:${identifier}`;

    // Check rate limit
    const result = await this.redis.checkRateLimit(key, limit, windowSeconds);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

    return true;
  }

  private getIdentifier(request: any): string {
    // Try to get user ID first
    if (request.user?.id) {
      return `user:${request.user.id}`;
    }
    
    // Fall back to IP address
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }
}

