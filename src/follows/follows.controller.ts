import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('follows')
@UseGuards(RateLimitGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post('user/:userId')
  @UseGuards(JwtAuthGuard)
  @RateLimit(30, 60) // 30 requests per minute
  async follow(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    try {
      const followerId = req.user.userId || req.user.id;
      return await this.followsService.follow(followerId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Delete('user/:userId')
  @UseGuards(JwtAuthGuard)
  @RateLimit(30, 60) // 30 requests per minute
  async unfollow(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    try {
      const followerId = req.user.userId || req.user.id;
      return await this.followsService.unfollow(followerId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Get('user/:userId/followers')
  @RateLimit(100, 60) // 100 requests per minute
  async getFollowers(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    try {
      return await this.followsService.getFollowers(userId, limit, offset);
    } catch (error) {
      throw error;
    }
  }

  @Get('user/:userId/following')
  @RateLimit(100, 60) // 100 requests per minute
  async getFollowing(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    try {
      return await this.followsService.getFollowing(userId, limit, offset);
    } catch (error) {
      throw error;
    }
  }

  @Get('user/:userId/status')
  @RateLimit(200, 60) // 200 requests per minute
  async getFollowStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    try {
      // Extract userId if user is authenticated (optional for this endpoint)
      const followerId = req.user?.userId || req.user?.id;
      if (!followerId) {
        return {
          success: true,
          data: {
            isFollowing: false,
          },
        };
      }
      return await this.followsService.getFollowStatus(followerId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Get('user/:userId/counts')
  @RateLimit(200, 60) // 200 requests per minute
  async getFollowCounts(@Param('userId', ParseIntPipe) userId: number) {
    try {
      return await this.followsService.getFollowCounts(userId);
    } catch (error) {
      throw error;
    }
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @RateLimit(100, 60) // 100 requests per minute
  async getFeed(
    @Request() req: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.followsService.getFeed(userId, limit, offset);
    } catch (error) {
      throw error;
    }
  }
}

