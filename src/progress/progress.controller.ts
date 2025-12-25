import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ProgressService } from './progress.service';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('progress')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('update')
  @RateLimit(30, 60)
  async updateProgress(@Request() req: any, @Body() updateProgressDto: UpdateProgressDto) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.progressService.updateProgress(userId, updateProgressDto);
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @RateLimit(100, 60)
  getUserProgress(@Request() req: any) {
    const userId = req.user.userId || req.user.id;
    return this.progressService.getUserProgress(userId);
  }

  @Get('tutorial/:tutorialId')
  @RateLimit(100, 60)
  getTutorialProgress(
    @Request() req: any,
    @Param('tutorialId', ParseIntPipe) tutorialId: number,
  ) {
    const userId = req.user.userId || req.user.id;
    return this.progressService.getTutorialProgress(userId, tutorialId);
  }

  @Get('stats')
  @RateLimit(100, 60)
  getProgressStats(@Request() req: any) {
    const userId = req.user.userId || req.user.id;
    return this.progressService.getProgressStats(userId);
  }

  @Get('activity')
  @RateLimit(100, 60)
  getRecentActivity(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user.userId || req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    // Validate limit
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return this.progressService.getRecentActivity(userId, 10);
    }
    return this.progressService.getRecentActivity(userId, limitNum);
  }
}

