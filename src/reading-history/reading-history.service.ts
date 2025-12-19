import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReadingHistoryService {
  constructor(private prisma: PrismaService) {}

  async trackReading(userId: number, postId: number, progress: number) {
    return this.prisma.readingHistory.upsert({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      update: {
        progress: Math.min(100, Math.max(0, progress)),
        lastRead: new Date(),
      },
      create: {
        userId,
        postId,
        progress: Math.min(100, Math.max(0, progress)),
        lastRead: new Date(),
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImage: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }

  async getUserHistory(userId: number, limit = 20) {
    const history = await this.prisma.readingHistory.findMany({
      where: { userId },
      orderBy: { lastRead: 'desc' },
      take: limit,
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImage: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: history,
    };
  }

  async getPostProgress(userId: number, postId: number) {
    const history = await this.prisma.readingHistory.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    return {
      success: true,
      data: history || { progress: 0 },
    };
  }

  async deleteHistory(userId: number, postId: number) {
    await this.prisma.readingHistory.deleteMany({
      where: {
        userId,
        postId,
      },
    });

    return {
      success: true,
      message: 'Reading history deleted',
    };
  }
}

