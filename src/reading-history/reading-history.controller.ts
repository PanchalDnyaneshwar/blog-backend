import { Controller, Post, Get, Delete, Body, Request, UseGuards, Param, ParseIntPipe } from '@nestjs/common';
import { ReadingHistoryService } from './reading-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reading-history')
@UseGuards(JwtAuthGuard)
export class ReadingHistoryController {
  constructor(private readonly readingHistoryService: ReadingHistoryService) {}

  @Post('track')
  async trackReading(@Body() body: { postId: number; progress: number }, @Request() req) {
    return this.readingHistoryService.trackReading(req.user.id, body.postId, body.progress);
  }

  @Get()
  async getUserHistory(@Request() req) {
    return this.readingHistoryService.getUserHistory(req.user.id);
  }

  @Get('post/:postId')
  async getPostProgress(@Param('postId', ParseIntPipe) postId: number, @Request() req) {
    return this.readingHistoryService.getPostProgress(req.user.id, postId);
  }

  @Delete('post/:postId')
  async deleteHistory(@Param('postId', ParseIntPipe) postId: number, @Request() req) {
    return this.readingHistoryService.deleteHistory(req.user.id, postId);
  }
}

