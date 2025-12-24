import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTutorialDto } from './dto/create-tutorial.dto';
import { UpdateTutorialDto } from './dto/update-tutorial.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { SanitizeService } from '../common/services/sanitize.service';

@Injectable()
export class TutorialsService {
  constructor(
    private prisma: PrismaService,
    private sanitizeService: SanitizeService,
  ) {}

  async create(createTutorialDto: CreateTutorialDto) {
    // Check if slug already exists
    const existing = await this.prisma.tutorial.findUnique({
      where: { slug: createTutorialDto.slug },
    });

    if (existing) {
      throw new BadRequestException('Tutorial with this slug already exists');
    }

    // Sanitize content
    const sanitizedData = {
      ...createTutorialDto,
      description: createTutorialDto.description
        ? this.sanitizeService.sanitizeText(createTutorialDto.description)
        : null,
      introContent: createTutorialDto.introContent
        ? this.sanitizeService.sanitizeRichText(createTutorialDto.introContent)
        : null,
    };

    const tutorial = await this.prisma.tutorial.create({
      data: sanitizedData,
      include: {
        lessons: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return {
      success: true,
      data: tutorial,
    };
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    published?: boolean;
    difficulty?: string;
    search?: string;
  }) {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.published !== undefined) {
      // Handle both boolean and string 'true'/'false' from query params
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

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [tutorials, total] = await Promise.all([
      this.prisma.tutorial.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lessons: {
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              title: true,
              slug: true,
              orderIndex: true,
              estimatedTime: true,
            },
          },
          _count: {
            select: {
              lessons: true,
            },
          },
        },
      }),
      this.prisma.tutorial.count({ where }),
    ]);

    return {
      success: true,
      data: tutorials,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(slug: string) {
    const tutorial = await this.prisma.tutorial.findUnique({
      where: { slug },
      include: {
        lessons: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!tutorial) {
      throw new NotFoundException('Tutorial not found');
    }

    return {
      success: true,
      data: tutorial,
    };
  }

  async update(id: number, updateTutorialDto: UpdateTutorialDto) {
    const tutorial = await this.prisma.tutorial.findUnique({
      where: { id },
    });

    if (!tutorial) {
      throw new NotFoundException('Tutorial not found');
    }

    // Check slug uniqueness if slug is being updated
    if (updateTutorialDto.slug && updateTutorialDto.slug !== tutorial.slug) {
      const existing = await this.prisma.tutorial.findUnique({
        where: { slug: updateTutorialDto.slug },
      });

      if (existing) {
        throw new BadRequestException('Tutorial with this slug already exists');
      }
    }

    // Sanitize content
    const sanitizedData: any = { ...updateTutorialDto };
    if (updateTutorialDto.description !== undefined) {
      sanitizedData.description = updateTutorialDto.description
        ? this.sanitizeService.sanitizeText(updateTutorialDto.description)
        : null;
    }
    if (updateTutorialDto.introContent !== undefined) {
      sanitizedData.introContent = updateTutorialDto.introContent
        ? this.sanitizeService.sanitizeRichText(updateTutorialDto.introContent)
        : null;
    }

    const updated = await this.prisma.tutorial.update({
      where: { id },
      data: sanitizedData,
      include: {
        lessons: {
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
    const tutorial = await this.prisma.tutorial.findUnique({
      where: { id },
    });

    if (!tutorial) {
      throw new NotFoundException('Tutorial not found');
    }

    await this.prisma.tutorial.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Tutorial deleted successfully',
    };
  }

  // Lesson methods
  async createLesson(createLessonDto: CreateLessonDto) {
    // Verify tutorial exists
    const tutorial = await this.prisma.tutorial.findUnique({
      where: { id: createLessonDto.tutorialId },
    });

    if (!tutorial) {
      throw new NotFoundException('Tutorial not found');
    }

    // Check if slug already exists for this tutorial
    const existing = await this.prisma.lesson.findUnique({
      where: {
        tutorialId_slug: {
          tutorialId: createLessonDto.tutorialId,
          slug: createLessonDto.slug,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Lesson with this slug already exists in this tutorial');
    }

    const lesson = await this.prisma.lesson.create({
      data: createLessonDto,
      include: {
        tutorial: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return {
      success: true,
      data: lesson,
    };
  }

  async updateLesson(id: number, updateLessonDto: UpdateLessonDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check slug uniqueness if slug is being updated
    if (updateLessonDto.slug && updateLessonDto.slug !== lesson.slug) {
      const tutorialId = updateLessonDto.tutorialId || lesson.tutorialId;
      const existing = await this.prisma.lesson.findUnique({
        where: {
          tutorialId_slug: {
            tutorialId,
            slug: updateLessonDto.slug,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('Lesson with this slug already exists in this tutorial');
      }
    }

    const updated = await this.prisma.lesson.update({
      where: { id },
      data: updateLessonDto,
      include: {
        tutorial: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return {
      success: true,
      data: updated,
    };
  }

  async removeLesson(id: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.prisma.lesson.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Lesson deleted successfully',
    };
  }

  async getLesson(tutorialSlug: string, lessonSlug: string) {
    const tutorial = await this.prisma.tutorial.findUnique({
      where: { slug: tutorialSlug },
      include: {
        lessons: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            slug: true,
            orderIndex: true,
          },
        },
      },
    });

    if (!tutorial) {
      throw new NotFoundException('Tutorial not found');
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: {
        tutorialId_slug: {
          tutorialId: tutorial.id,
          slug: lessonSlug,
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Get previous and next lessons
    const currentIndex = tutorial.lessons.findIndex((l) => l.id === lesson.id);
    const previousLesson = currentIndex > 0 ? tutorial.lessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < tutorial.lessons.length - 1 ? tutorial.lessons[currentIndex + 1] : null;

    return {
      success: true,
      data: {
        lesson,
        tutorial: {
          id: tutorial.id,
          title: tutorial.title,
          slug: tutorial.slug,
        },
        navigation: {
          previous: previousLesson,
          next: nextLesson,
          currentIndex: currentIndex + 1,
          totalLessons: tutorial.lessons.length,
        },
      },
    };
  }
}

