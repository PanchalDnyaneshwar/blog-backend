import { Module, Global } from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { RedisModule } from '../redis/redis.module';
import { SanitizeService } from './services/sanitize.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [RateLimitGuard, CsrfGuard, SanitizeService],
  exports: [RateLimitGuard, CsrfGuard, SanitizeService],
})
export class CommonModule {}

