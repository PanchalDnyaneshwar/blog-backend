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
    
    // If no specific rate limit is set, apply default global rate limit
    if (!rateLimitMeta) {
      // Default rate limit: 100 requests per minute for all endpoints
      const defaultLimit = 100;
      const defaultWindow = 60;
      
      const identifier = this.getIdentifier(request);
      const key = `rate_limit:global:${request.method}:${request.path}:${identifier}`;
      
      const result = await this.redis.checkRateLimit(key, defaultLimit, defaultWindow);
      
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
      response.setHeader('X-RateLimit-Limit', defaultLimit);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      response.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
      
      return true;
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
    
    // Get IP address (check X-Forwarded-For for reverse proxies)
    let ip = request.ip;
    
    // Check X-Forwarded-For header (for reverse proxies/load balancers)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim();
    }
    
    // Fall back to connection remote address
    if (!ip) {
      ip = request.connection?.remoteAddress || request.socket?.remoteAddress;
    }
    
    return ip || 'unknown';
  }
}

