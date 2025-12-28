import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async follow(followerId: number, followingId: number) {
    try {
      // Prevent self-follow
      if (followerId === followingId) {
        throw new BadRequestException('Cannot follow yourself');
      }

      // Check if user to follow exists
      const userToFollow = await this.prisma.user.findUnique({
        where: { id: followingId },
      });

      if (!userToFollow) {
        throw new NotFoundException('User not found');
      }

      // Check if already following
      const existingFollow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existingFollow) {
        throw new ConflictException('Already following this user');
      }

      // Create follow relationship
      const follow = await this.prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          following: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Create notification for the user being followed
      try {
        await this.notificationsService.create({
          userId: followingId,
          type: 'FOLLOW',
          title: 'New Follower',
          message: `${follow.follower.name} started following you`,
          link: `/users/${followerId}`,
        });
      } catch (notificationError) {
        // Log but don't fail the follow operation
        this.logger.warn(`Failed to create follow notification: ${notificationError.message}`);
      }

      return {
        success: true,
        data: follow,
        message: 'Successfully followed user',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Failed to follow user ${followingId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async unfollow(followerId: number, followingId: number) {
    try {
      // Check if follow relationship exists
      const existingFollow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (!existingFollow) {
        throw new NotFoundException('Not following this user');
      }

      // Delete follow relationship
      await this.prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      return {
        success: true,
        message: 'Successfully unfollowed user',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to unfollow user ${followingId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFollowers(userId: number, limit: number = 20, offset: number = 0) {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get followers
      const [followers, total] = await Promise.all([
        this.prisma.follow.findMany({
          where: { followingId: userId },
          include: {
            follower: {
              select: {
                id: true,
                name: true,
                avatar: true,
                bio: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.follow.count({
          where: { followingId: userId },
        }),
      ]);

      return {
        success: true,
        data: followers.map((f) => f.follower),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get followers for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFollowing(userId: number, limit: number = 20, offset: number = 0) {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get following
      const [following, total] = await Promise.all([
        this.prisma.follow.findMany({
          where: { followerId: userId },
          include: {
            following: {
              select: {
                id: true,
                name: true,
                avatar: true,
                bio: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.follow.count({
          where: { followerId: userId },
        }),
      ]);

      return {
        success: true,
        data: following.map((f) => f.following),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get following for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFollowStatus(followerId: number, followingId: number) {
    try {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      return {
        success: true,
        data: {
          isFollowing: !!follow,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get follow status for user ${followingId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getFollowCounts(userId: number) {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const [followersCount, followingCount] = await Promise.all([
        this.prisma.follow.count({
          where: { followingId: userId },
        }),
        this.prisma.follow.count({
          where: { followerId: userId },
        }),
      ]);

      return {
        success: true,
        data: {
          followersCount,
          followingCount,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get follow counts for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeed(userId: number, limit: number = 20, offset: number = 0) {
    try {
      // Get list of users being followed
      const following = await this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });

      const followingIds = following.map((f) => f.followingId);

      // If not following anyone, return empty feed
      if (followingIds.length === 0) {
        return {
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
        };
      }

      // Get posts from followed users
      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where: {
            authorId: { in: followingIds },
            published: true,
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                comments: true,
                likes: true,
              },
            },
          },
          orderBy: { publishedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.post.count({
          where: {
            authorId: { in: followingIds },
            published: true,
          },
        }),
      ]);

      // Map posts to include like count
      const mappedPosts = posts.map((post) => ({
        ...post,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
      }));

      return {
        success: true,
        data: mappedPosts,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get feed for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}

