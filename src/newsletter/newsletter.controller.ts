import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';
import { UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString } from 'class-validator';

class SubscribeDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class UnsubscribeDto {
  @IsEmail()
  email: string;
}

@Controller('newsletter')
@UseGuards(RateLimitGuard)
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @RateLimit(5, 60) // 5 subscriptions per minute
  async subscribe(@Body() subscribeDto: SubscribeDto) {
    return this.newsletterService.subscribe(subscribeDto.email, subscribeDto.name);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @RateLimit(5, 60) // 5 unsubscriptions per minute
  async unsubscribe(@Body() unsubscribeDto: UnsubscribeDto) {
    return this.newsletterService.unsubscribe(unsubscribeDto.email);
  }
}

