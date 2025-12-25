import {
  Controller,
  Get,
  Request,
  UseGuards,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('recommendations')
@UseGuards(RateLimitGuard)
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('content-based')
  @UseGuards(JwtAuthGuard)
  @RateLimit(50, 60)
  async getContentBasedRecommendations(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      if (!userId) {
        return {
          success: true,
          data: [],
        };
      }
      const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 20) : 10;
      return await this.recommendationsService.getContentBasedRecommendations(userId, limitNum);
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    }
  }

  @Get('next-to-read')
  @UseGuards(JwtAuthGuard)
  @RateLimit(50, 60)
  async getNextToRead(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      if (!userId) {
        return {
          success: true,
          data: [],
        };
      }
      const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 10) : 5;
      return await this.recommendationsService.getNextToRead(userId, limitNum);
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    }
  }

  @Get('post/:postId')
  @RateLimit(100, 60)
  async getPostRecommendations(
    @Param('postId', ParseIntPipe) postId: number,
    @Query('limit') limit?: string,
  ) {
    try {
      const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 10) : 5;
      return await this.recommendationsService.getPostRecommendations(postId, limitNum);
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    }
  }

  @Get('tutorials')
  @UseGuards(JwtAuthGuard)
  @RateLimit(50, 60)
  async getTutorialRecommendations(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      if (!userId) {
        return {
          success: true,
          data: [],
        };
      }
      const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 10) : 5;
      return await this.recommendationsService.getTutorialRecommendations(userId, limitNum);
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    }
  }
}

