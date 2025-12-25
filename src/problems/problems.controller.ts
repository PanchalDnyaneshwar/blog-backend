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
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import { SubmitSolutionDto } from './dto/submit-solution.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  // Public endpoints
  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60)
  findAll(@Query() query: any) {
    return this.problemsService.findAll(query);
  }

  @Get(':slug')
  @UseGuards(RateLimitGuard)
  @RateLimit(100, 60)
  findOne(@Param('slug') slug: string) {
    return this.problemsService.findOne(slug);
  }

  // Admin endpoints
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  create(@Body() createProblemDto: CreateProblemDto) {
    return this.problemsService.create(createProblemDto);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  findOneById(@Param('id', ParseIntPipe) id: number) {
    return this.problemsService.findOneById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProblemDto: UpdateProblemDto,
  ) {
    return this.problemsService.update(id, updateProblemDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.problemsService.remove(id);
  }

  // Test Case endpoints
  @Post('test-cases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 60)
  createTestCase(@Body() createTestCaseDto: CreateTestCaseDto) {
    return this.problemsService.createTestCase(createTestCaseDto);
  }

  @Patch('test-cases/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 60)
  updateTestCase(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTestCaseDto: UpdateTestCaseDto,
  ) {
    return this.problemsService.updateTestCase(id, updateTestCaseDto);
  }

  @Delete('test-cases/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60)
  removeTestCase(@Param('id', ParseIntPipe) id: number) {
    return this.problemsService.removeTestCase(id);
  }

  // Submission endpoints
  @Post('submit')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit(20, 60) // Limit submissions
  submitSolution(@Request() req: any, @Body() submitSolutionDto: SubmitSolutionDto) {
    const userId = req.user.userId || req.user.id;
    return this.problemsService.submitSolution(userId, submitSolutionDto);
  }

  @Get('submissions/me')
  @UseGuards(JwtAuthGuard)
  getUserSubmissions(@Request() req: any, @Query('problemId') problemId?: string) {
    const userId = req.user.userId || req.user.id;
    const problemIdNum = problemId ? parseInt(problemId, 10) : undefined;
    return this.problemsService.getUserSubmissions(userId, problemIdNum);
  }
}

