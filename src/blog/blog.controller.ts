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
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('blogs')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60) // 100 requests per minute
  findAll(@Query() query: any) {
    return this.blogService.findAll(query);
  }

  @Get('categories')
  @UseGuards(RateLimitGuard)
  @RateLimit(200, 60) // 200 requests per minute
  getCategories() {
    return this.blogService.getCategories();
  }

  @Get('tags')
  @UseGuards(RateLimitGuard)
  @RateLimit(200, 60) // 200 requests per minute
  getTags() {
    return this.blogService.getTags();
  }

  @Get('related')
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60) // 100 requests per minute
  getRelatedPosts(@Query() query: any) {
    return this.blogService.getRelatedPosts(
      query.exclude ? parseInt(query.exclude) : undefined,
      query.category ? parseInt(query.category) : undefined,
      query.limit ? parseInt(query.limit) : 3,
    );
  }

  @Get(':slug')
  @UseGuards(RateLimitGuard)
  @RateLimit(200, 60) // 200 requests per minute
  findOne(@Param('slug') slug: string) {
    return this.blogService.findOne(slug);
  }

  @Get('id/:id')
  @UseGuards(JwtAuthGuard)
  getPostById(@Param('id') id: string) {
    return this.blogService.getPostById(parseInt(id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60) // 10 requests per minute for creating posts
  create(@Body() createPostDto: CreatePostDto, @Request() req: any) {
    return this.blogService.create(createPostDto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 60) // 20 requests per minute for updating posts
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    return this.blogService.update(parseInt(id), updatePostDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.blogService.remove(parseInt(id));
  }
}
