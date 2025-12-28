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
} from '@nestjs/common';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('likes')
@UseGuards(RateLimitGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('post/:postId')
  @UseGuards(JwtAuthGuard)
  @RateLimit(60, 60) // 60 requests per minute
  async likePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.likesService.likePost(postId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Delete('post/:postId')
  @UseGuards(JwtAuthGuard)
  @RateLimit(60, 60) // 60 requests per minute
  async unlikePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.likesService.unlikePost(postId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Get('post/:postId')
  @RateLimit(200, 60) // 200 requests per minute
  async getPostLikes(
    @Param('postId', ParseIntPipe) postId: number,
    @Request() req: any,
    @Query('users') includeUsers?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      // Extract userId if user is authenticated (optional for this endpoint)
      const userId = req.user?.userId || req.user?.id || undefined;
      
      if (includeUsers === 'true') {
        const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 50) : 10;
        return await this.likesService.getPostLikesUsers(postId, limitNum);
      }
      
      return await this.likesService.getPostLikes(postId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Post('comment/:commentId')
  @UseGuards(JwtAuthGuard)
  @RateLimit(60, 60) // 60 requests per minute
  async likeComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.likesService.likeComment(commentId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Delete('comment/:commentId')
  @UseGuards(JwtAuthGuard)
  @RateLimit(60, 60) // 60 requests per minute
  async unlikeComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.likesService.unlikeComment(commentId, userId);
    } catch (error) {
      throw error;
    }
  }

  @Get('comment/:commentId')
  @RateLimit(200, 60) // 200 requests per minute
  async getCommentLikes(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Request() req: any,
  ) {
    try {
      // Extract userId if user is authenticated (optional for this endpoint)
      const userId = req.user?.userId || req.user?.id || undefined;
      return await this.likesService.getCommentLikes(commentId, userId);
    } catch (error) {
      throw error;
    }
  }
}

