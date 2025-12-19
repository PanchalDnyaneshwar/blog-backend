import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findAll(@Query('postId') postId?: string, @Query('approved') approved?: string) {
    return this.commentsService.findAll(
      postId ? +postId : undefined,
      approved === 'true' ? true : approved === 'false' ? false : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commentsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createCommentDto: CreateCommentDto, @Request() req) {
    return this.commentsService.create(createCommentDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCommentDto: UpdateCommentDto, @Request() req) {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'EDITOR';
    return this.commentsService.update(+id, updateCommentDto, req.user.id, isAdmin);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'EDITOR';
    return this.commentsService.remove(+id, req.user.id, isAdmin);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/approve')
  approve(@Param('id') id: string, @Request() req) {
    // Only admin/editor can approve
    if (req.user.role !== 'ADMIN' && req.user.role !== 'EDITOR') {
      throw new Error('Unauthorized');
    }
    return this.commentsService.approve(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Request() req) {
    // Only admin/editor can reject
    if (req.user.role !== 'ADMIN' && req.user.role !== 'EDITOR') {
      throw new Error('Unauthorized');
    }
    return this.commentsService.reject(+id);
  }
}

