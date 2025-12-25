import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async findAll(query?: { page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: user,
    };
  }

  /**
   * Get public profile (without sensitive data)
   */
  async getPublicProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        bio: true,
        avatar: true,
        website: true,
        github: true,
        twitter: true,
        linkedin: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user statistics
    const stats = await this.getUserStatistics(id);

    return {
      success: true,
      data: {
        ...user,
        stats,
      },
    };
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId: number) {
    const [
      postsCount,
      commentsCount,
      bookmarksCount,
      tutorialsCompleted,
      problemsSolved,
    ] = await Promise.all([
      // Posts written
      this.prisma.post.count({
        where: {
          authorId: userId,
          published: true,
        },
      }),
      // Comments made
      this.prisma.comment.count({
        where: {
          userId,
          approved: true,
        },
      }),
      // Bookmarks
      this.prisma.bookmark.count({
        where: { userId },
      }),
      // Tutorials completed
      this.prisma.userProgress.count({
        where: {
          userId,
          tutorialId: { not: null },
          lessonId: null,
          progressPercent: 100,
        },
      }),
      // Problems solved
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
      posts: postsCount,
      comments: commentsCount,
      bookmarks: bookmarksCount,
      tutorialsCompleted,
      problemsSolved,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Convert empty strings to null to avoid storing empty strings
    // Only include fields that are actually provided (not undefined)
    const dataToUpdate: any = {};
    Object.keys(updateProfileDto).forEach((key) => {
      const value = (updateProfileDto as any)[key];
      // Only include if value is defined and not empty string
      if (value !== undefined) {
        dataToUpdate[key] = value === '' || value === null ? null : value;
      }
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatar: true,
        website: true,
        github: true,
        twitter: true,
        linkedin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: updated,
    };
  }

  async remove(id: number) {
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  /**
   * Export all user data for GDPR compliance (Right to Access)
   */
  async exportUserData(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all user-related data
    const [comments, bookmarks, readingHistory] = await Promise.all([
      // Comments
      this.prisma.comment.findMany({
        where: { userId },
        select: {
          id: true,
          content: true,
          postId: true,
          parentId: true,
          approved: true,
          createdAt: true,
          updatedAt: true,
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Bookmarks
      this.prisma.bookmark.findMany({
        where: { userId },
        select: {
          id: true,
          postId: true,
          createdAt: true,
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Reading History
      this.prisma.readingHistory.findMany({
        where: { userId },
        select: {
          id: true,
          postId: true,
          progress: true,
          lastRead: true,
          createdAt: true,
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { lastRead: 'desc' },
      }),
    ]);

    // Compile all user data
    const userData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountCreated: user.createdAt,
        accountLastUpdated: user.updatedAt,
      },
      data: {
        comments: {
          total: comments.length,
          items: comments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            post: {
              id: comment.post.id,
              title: comment.post.title,
              slug: comment.post.slug,
            },
            isApproved: comment.approved,
            isReply: !!comment.parentId,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
          })),
        },
        bookmarks: {
          total: bookmarks.length,
          items: bookmarks.map((bookmark) => ({
            id: bookmark.id,
            post: {
              id: bookmark.post.id,
              title: bookmark.post.title,
              slug: bookmark.post.slug,
            },
            savedAt: bookmark.createdAt,
          })),
        },
        readingHistory: {
          total: readingHistory.length,
          items: readingHistory.map((history) => ({
            id: history.id,
            post: {
              id: history.post.id,
              title: history.post.title,
              slug: history.post.slug,
            },
            progress: history.progress,
            lastRead: history.lastRead,
            firstRead: history.createdAt,
          })),
        },
      },
      summary: {
        totalComments: comments.length,
        totalBookmarks: bookmarks.length,
        totalArticlesRead: readingHistory.length,
        averageReadingProgress: readingHistory.length > 0
          ? Math.round(
              readingHistory.reduce((sum, h) => sum + h.progress, 0) /
                readingHistory.length
            )
          : 0,
      },
    };

    return {
      success: true,
      data: userData,
    };
  }

  /**
   * Delete user account (GDPR Right to Erasure)
   * This will cascade delete all user-related data
   */
  async deleteMyAccount(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent admin account deletion (safety measure)
    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts cannot be deleted through self-service');
    }

    // Invalidate all refresh tokens for this user
    try {
      // Delete all refresh tokens for this user using pattern matching
      await this.redisService.deletePattern(`refresh_token:user:${userId}:*`);
      await this.redisService.deletePattern(`admin_refresh_token:user:${userId}:*`);
    } catch (error) {
      // Continue even if Redis fails
      console.error('Error invalidating refresh tokens:', error);
    }

    // Delete user (cascade deletes: comments, bookmarks, reading history, progress)
    // Posts authored by user will have authorId set to null (onDelete: SetNull)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      success: true,
      message: 'Account deleted successfully. All your data has been permanently removed.',
    };
  }
}
