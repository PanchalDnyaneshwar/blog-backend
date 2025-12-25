import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProgressDto } from './dto/update-progress.dto';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  async updateProgress(userId: number, updateProgressDto: UpdateProgressDto) {
    const { tutorialId, lessonId, progressPercent } = updateProgressDto;

    // Validate that tutorial exists if provided
    if (tutorialId) {
      const tutorial = await this.prisma.tutorial.findUnique({
        where: { id: tutorialId },
      });
      if (!tutorial) {
        throw new NotFoundException(`Tutorial with ID ${tutorialId} not found`);
      }
    }

    // Validate that lesson exists if provided
    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
      });
      if (!lesson) {
        throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
      }
      // If lesson is provided, ensure it belongs to the tutorial
      if (tutorialId && lesson.tutorialId !== tutorialId) {
        throw new BadRequestException('Lesson does not belong to the specified tutorial');
      }
    }

    // Find existing progress or create new
    const existing = await this.prisma.userProgress.findFirst({
      where: {
        userId,
        tutorialId: tutorialId || null,
        lessonId: lessonId || null,
      },
    });

    const progressData: any = {
      userId,
      progressPercent,
      completedAt: progressPercent === 100 ? new Date() : null,
    };

    if (tutorialId) progressData.tutorialId = tutorialId;
    if (lessonId) progressData.lessonId = lessonId;

    if (existing) {
      const updated = await this.prisma.userProgress.update({
        where: { id: existing.id },
        data: progressData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        success: true,
        data: updated,
      };
    } else {
      const created = await this.prisma.userProgress.create({
        data: progressData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        success: true,
        data: created,
      };
    }
  }

  async getUserProgress(userId: number) {
    const progress = await this.prisma.userProgress.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Fetch tutorial names for tutorial-level progress
    const tutorialIds = progress
      .filter((p) => p.tutorialId && !p.lessonId)
      .map((p) => p.tutorialId)
      .filter((id): id is number => id !== null);

    const tutorials = tutorialIds.length > 0
      ? await this.prisma.tutorial.findMany({
          where: { id: { in: tutorialIds } },
          select: { id: true, title: true, slug: true },
        })
      : [];

    // Add tutorial info to progress items
    const progressWithTutorials = progress.map((p) => {
      if (p.tutorialId && !p.lessonId) {
        const tutorial = tutorials.find((t) => t.id === p.tutorialId);
        return {
          ...p,
          tutorial: tutorial || null,
        };
      }
      return p;
    });

    return {
      success: true,
      data: progressWithTutorials,
    };
  }

  async getTutorialProgress(userId: number, tutorialId: number) {
    // Validate tutorial exists
    const tutorial = await this.prisma.tutorial.findUnique({
      where: { id: tutorialId },
    });
    if (!tutorial) {
      throw new NotFoundException(`Tutorial with ID ${tutorialId} not found`);
    }

    const progress = await this.prisma.userProgress.findFirst({
      where: {
        userId,
        tutorialId,
        lessonId: null, // Tutorial-level progress
      },
    });

    // Get lesson-level progress
    const lessonProgress = await this.prisma.userProgress.findMany({
      where: {
        userId,
        tutorialId,
        lessonId: { not: null },
      },
    });

    return {
      success: true,
      data: {
        tutorial: progress,
        lessons: lessonProgress,
      },
    };
  }

  async getProgressStats(userId: number) {
    const [
      totalTutorials,
      completedTutorials,
      totalLessons,
      completedLessons,
      totalProblems,
      solvedProblems,
    ] = await Promise.all([
      // Total tutorials
      this.prisma.tutorial.count({ where: { published: true } }),
      // Completed tutorials
      this.prisma.userProgress.count({
        where: {
          userId,
          tutorialId: { not: null },
          lessonId: null,
          progressPercent: 100,
        },
      }),
      // Total lessons (from user's started tutorials)
      this.prisma.lesson.count({
        where: {
          tutorial: {
            published: true,
          },
        },
      }),
      // Completed lessons
      this.prisma.userProgress.count({
        where: {
          userId,
          lessonId: { not: null },
          progressPercent: 100,
        },
      }),
      // Total problems
      this.prisma.problem.count({ where: { published: true } }),
      // Solved problems (ACCEPTED submissions) - get distinct problem IDs
      this.prisma.problemSubmission.findMany({
        where: {
          userId,
          status: 'ACCEPTED',
        },
        select: {
          problemId: true,
        },
        distinct: ['problemId'],
      }).then((submissions) => submissions.length),
    ]);

    return {
      success: true,
      data: {
        tutorials: {
          total: totalTutorials,
          completed: completedTutorials,
          inProgress: await this.prisma.userProgress.count({
            where: {
              userId,
              tutorialId: { not: null },
              lessonId: null,
              progressPercent: { gt: 0, lt: 100 },
            },
          }),
        },
        lessons: {
          total: totalLessons,
          completed: completedLessons,
        },
        problems: {
          total: totalProblems,
          solved: solvedProblems,
        },
      },
    };
  }

  async getRecentActivity(userId: number, limit: number = 10) {
    const [tutorialProgress, problemSubmissions] = await Promise.all([
      this.prisma.userProgress.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.problemSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
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
      }),
    ]);

    // Combine and sort by date
    const activities: any[] = [
      ...tutorialProgress.map((p) => ({
        type: 'tutorial' as const,
        id: p.id,
        title: `Tutorial Progress: ${p.progressPercent}%`,
        date: p.updatedAt,
        data: p,
      })),
      ...problemSubmissions.map((s) => ({
        type: 'problem' as const,
        id: s.id,
        title: s.problem.title,
        date: s.createdAt,
        data: s,
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);

    return {
      success: true,
      data: activities,
    };
  }
}

