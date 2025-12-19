import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users/me/bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  findAll(@Request() req) {
    return this.bookmarksService.findAll(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() body: { postId: number }) {
    return this.bookmarksService.create(req.user.id, body.postId);
  }

  @Delete(':postId')
  remove(@Request() req, @Param('postId') postId: string) {
    return this.bookmarksService.remove(req.user.id, +postId);
  }
}

