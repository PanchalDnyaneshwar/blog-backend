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
  ParseIntPipe,
} from '@nestjs/common';
import { TutorialsService } from './tutorials.service';
import { CreateTutorialDto } from './dto/create-tutorial.dto';
import { UpdateTutorialDto } from './dto/update-tutorial.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('tutorials')
export class TutorialsController {
  constructor(private readonly tutorialsService: TutorialsService) {}

  // Public endpoints
  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60)
  findAll(@Query() query: any) {
    return this.tutorialsService.findAll(query);
  }

  @Get(':slug')
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60)
  findOne(@Param('slug') slug: string) {
    return this.tutorialsService.findOne(slug);
  }

  @Get(':tutorialSlug/lessons/:lessonSlug')
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60)
  getLesson(
    @Param('tutorialSlug') tutorialSlug: string,
    @Param('lessonSlug') lessonSlug: string,
  ) {
    return this.tutorialsService.getLesson(tutorialSlug, lessonSlug);
  }

  // Admin endpoints
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  create(@Body() createTutorialDto: CreateTutorialDto) {
    return this.tutorialsService.create(createTutorialDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTutorialDto: UpdateTutorialDto,
  ) {
    return this.tutorialsService.update(id, updateTutorialDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tutorialsService.remove(id);
  }

  // Lesson endpoints
  @Post('lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  createLesson(@Body() createLessonDto: CreateLessonDto) {
    return this.tutorialsService.createLesson(createLessonDto);
  }

  @Patch('lessons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  updateLesson(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.tutorialsService.updateLesson(id, updateLessonDto);
  }

  @Delete('lessons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  removeLesson(@Param('id', ParseIntPipe) id: number) {
    return this.tutorialsService.removeLesson(id);
  }
}

