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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('recommendations')
@UseGuards(RateLimitGuard)
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('content-based')
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit(50, 60)
  async getContentBasedRecommendations(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    try {
      // Make authentication optional - if user is authenticated, get personalized recommendations
      // Otherwise, return popular posts
      const userId = req.user?.userId || req.user?.id;
      const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 20) : 10;
      
      if (userId) {
        // User is authenticated - return personalized recommendations
        return await this.recommendationsService.getContentBasedRecommendations(userId, limitNum);
      } else {
        // User is not authenticated - return popular posts
        return await this.recommendationsService.getPopularPosts(limitNum);
      }
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    }
  }

  @Get('next-to-read')
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit(50, 60)
  async getNextToRead(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    try {
      // Make authentication optional - if user is authenticated, get next to read
      // Otherwise, return empty array
      const userId = req.user?.userId || req.user?.id;
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
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit(50, 60)
  async getTutorialRecommendations(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    try {
      // Make authentication optional - if user is authenticated, get personalized tutorials
      // Otherwise, return popular tutorials
      const userId = req.user?.userId || req.user?.id;
      const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 10) : 5;
      
      if (userId) {
        // User is authenticated - return personalized recommendations
        return await this.recommendationsService.getTutorialRecommendations(userId, limitNum);
      } else {
        // User is not authenticated - return popular tutorials
        return await this.recommendationsService.getPopularTutorials(limitNum);
      }
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    }
  }
}

