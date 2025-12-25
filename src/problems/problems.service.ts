import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import { SubmitSolutionDto } from './dto/submit-solution.dto';
import { SanitizeService } from '../common/services/sanitize.service';

@Injectable()
export class ProblemsService {
  constructor(
    private prisma: PrismaService,
    private sanitizeService: SanitizeService,
  ) {}

  async create(createProblemDto: CreateProblemDto) {
    // Check if slug already exists
    const existing = await this.prisma.problem.findUnique({
      where: { slug: createProblemDto.slug },
    });

    if (existing) {
      throw new BadRequestException('Problem with this slug already exists');
    }

    // Sanitize content
    const sanitizedData = {
      ...createProblemDto,
      description: this.sanitizeService.sanitizeRichText(createProblemDto.description),
      constraints: createProblemDto.constraints
        ? this.sanitizeService.sanitizeText(createProblemDto.constraints)
        : null,
      starterCode: createProblemDto.starterCode || null,
      solution: createProblemDto.solution || null,
    };

    const problem = await this.prisma.problem.create({
      data: sanitizedData,
      include: {
        testCases: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    return {
      success: true,
      data: problem,
    };
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    published?: boolean;
    difficulty?: string;
    category?: string;
    search?: string;
    tags?: string;
  }) {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.published !== undefined) {
      const publishedValue = query.published;
      if (typeof publishedValue === 'boolean') {
        where.published = publishedValue;
      } else if (typeof publishedValue === 'string') {
        where.published = publishedValue === 'true' || publishedValue === '1';
      }
    }

    if (query?.difficulty) {
      where.difficulty = query.difficulty;
    }

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.tags) {
      const tagArray = Array.isArray(query.tags) ? query.tags : [query.tags];
      where.tags = {
        hasSome: tagArray,
      };
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [problems, total] = await Promise.all([
      this.prisma.problem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              submissions: true,
              testCases: true,
            },
          },
        },
      }),
      this.prisma.problem.count({ where }),
    ]);

    return {
      data: problems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(slug: string) {
    const problem = await this.prisma.problem.findUnique({
      where: { slug },
      include: {
        testCases: {
          where: { isPublic: true },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            isPublic: true,
            orderIndex: true,
          },
        },
        _count: {
          select: {
            submissions: true,
            testCases: true,
          },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // Don't return solution to non-admin users
    const { solution, ...problemData } = problem;
    return {
      success: true,
      data: problemData,
    };
  }

  async findOneById(id: number) {
    const problem = await this.prisma.problem.findUnique({
      where: { id },
      include: {
        testCases: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: {
            submissions: true,
            testCases: true,
          },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    return {
      success: true,
      data: problem,
    };
  }

  async update(id: number, updateProblemDto: UpdateProblemDto) {
    const problem = await this.prisma.problem.findUnique({
      where: { id },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // Check slug uniqueness if slug is being updated
    if (updateProblemDto.slug && updateProblemDto.slug !== problem.slug) {
      const existing = await this.prisma.problem.findUnique({
        where: { slug: updateProblemDto.slug },
      });

      if (existing) {
        throw new BadRequestException('Problem with this slug already exists');
      }
    }

    // Sanitize content
    const sanitizedData: any = { ...updateProblemDto };
    if (updateProblemDto.description) {
      sanitizedData.description = this.sanitizeService.sanitizeRichText(updateProblemDto.description);
    }
    if (updateProblemDto.constraints) {
      sanitizedData.constraints = this.sanitizeService.sanitizeText(updateProblemDto.constraints);
    }

    const updated = await this.prisma.problem.update({
      where: { id },
      data: sanitizedData,
      include: {
        testCases: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return {
      success: true,
      data: updated,
    };
  }

  async remove(id: number) {
    const problem = await this.prisma.problem.findUnique({
      where: { id },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    await this.prisma.problem.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Problem deleted successfully',
    };
  }

  // Test Case methods
  async createTestCase(createTestCaseDto: CreateTestCaseDto) {
    // Verify problem exists
    const problem = await this.prisma.problem.findUnique({
      where: { id: createTestCaseDto.problemId },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    const testCase = await this.prisma.testCase.create({
      data: createTestCaseDto,
    });

    return {
      success: true,
      data: testCase,
    };
  }

  async updateTestCase(id: number, updateTestCaseDto: UpdateTestCaseDto) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
    });

    if (!testCase) {
      throw new NotFoundException('TestCase not found');
    }

    const updated = await this.prisma.testCase.update({
      where: { id },
      data: updateTestCaseDto,
    });

    return {
      success: true,
      data: updated,
    };
  }

  async removeTestCase(id: number) {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
    });

    if (!testCase) {
      throw new NotFoundException('TestCase not found');
    }

    await this.prisma.testCase.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'TestCase deleted successfully',
    };
  }

  // Submission methods (simplified - no code execution yet)
  async submitSolution(userId: number, submitSolutionDto: SubmitSolutionDto) {
    // Verify problem exists
    const problem = await this.prisma.problem.findUnique({
      where: { id: submitSolutionDto.problemId },
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // For now, just create a pending submission
    // Code execution will be implemented later
    const submission = await this.prisma.problemSubmission.create({
      data: {
        userId,
        problemId: submitSolutionDto.problemId,
        code: submitSolutionDto.code,
        language: submitSolutionDto.language || 'javascript',
        status: 'PENDING',
      },
    });

    // TODO: Execute code against test cases
    // For now, return pending status

    return {
      success: true,
      data: submission,
      message: 'Submission received. Code execution will be implemented soon.',
    };
  }

  async getUserSubmissions(userId: number, problemId?: number) {
    const where: any = { userId };
    if (problemId) {
      where.problemId = problemId;
    }

    const submissions = await this.prisma.problemSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true,
          },
        },
      },
    });

    return {
      success: true,
      data: submissions,
    };
  }
}

