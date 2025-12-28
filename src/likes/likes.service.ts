import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name);

  constructor(private prisma: PrismaService) {}

  async likePost(postId: number, userId: number) {
    try {
      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Check if user already liked this post
      const existingLike = await this.prisma.postLike.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (existingLike) {
        throw new ConflictException('Post already liked by this user');
      }

      // Create like
      const like = await this.prisma.postLike.create({
        data: {
          userId,
          postId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Get updated like count
      const likeCount = await this.prisma.postLike.count({
        where: { postId },
      });

      return {
        success: true,
        data: {
          like,
          likeCount,
          isLiked: true,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Failed to like post ${postId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async unlikePost(postId: number, userId: number) {
    try {
      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Check if like exists
      const existingLike = await this.prisma.postLike.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (!existingLike) {
        throw new NotFoundException('Post not liked by this user');
      }

      // Delete like
      await this.prisma.postLike.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      // Get updated like count
      const likeCount = await this.prisma.postLike.count({
        where: { postId },
      });

      return {
        success: true,
        data: {
          likeCount,
          isLiked: false,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to unlike post ${postId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPostLikes(postId: number, userId?: number) {
    try {
      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Get like count
      const likeCount = await this.prisma.postLike.count({
        where: { postId },
      });

      // Check if current user liked this post
      let isLiked = false;
      if (userId) {
        const userLike = await this.prisma.postLike.findUnique({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });
        isLiked = !!userLike;
      }

      return {
        success: true,
        data: {
          likeCount,
          isLiked,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get likes for post ${postId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPostLikesUsers(postId: number, limit: number = 10) {
    try {
      // Check if post exists
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Get users who liked this post
      const likes = await this.prisma.postLike.findMany({
        where: { postId },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      return {
        success: true,
        data: likes.map((like) => like.user),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get likes users for post ${postId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async likeComment(commentId: number, userId: number) {
    try {
      // Check if comment exists and is approved
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      if (!comment.approved) {
        throw new NotFoundException('Comment not available');
      }

      // Check if user already liked this comment
      const existingLike = await this.prisma.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      if (existingLike) {
        throw new ConflictException('Comment already liked by this user');
      }

      // Create like
      const like = await this.prisma.commentLike.create({
        data: {
          userId,
          commentId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Get updated like count
      const likeCount = await this.prisma.commentLike.count({
        where: { commentId },
      });

      return {
        success: true,
        data: {
          like,
          likeCount,
          isLiked: true,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Failed to like comment ${commentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async unlikeComment(commentId: number, userId: number) {
    try {
      // Check if comment exists and is approved
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      if (!comment.approved) {
        throw new NotFoundException('Comment not available');
      }

      // Check if like exists
      const existingLike = await this.prisma.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      if (!existingLike) {
        throw new NotFoundException('Comment not liked by this user');
      }

      // Delete like
      await this.prisma.commentLike.delete({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      // Get updated like count
      const likeCount = await this.prisma.commentLike.count({
        where: { commentId },
      });

      return {
        success: true,
        data: {
          likeCount,
          isLiked: false,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to unlike comment ${commentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getCommentLikes(commentId: number, userId?: number) {
    try {
      // Check if comment exists (don't require approval for getting likes count)
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      // Get like count
      const likeCount = await this.prisma.commentLike.count({
        where: { commentId },
      });

      // Check if current user liked this comment
      let isLiked = false;
      if (userId) {
        const userLike = await this.prisma.commentLike.findUnique({
          where: {
            userId_commentId: {
              userId,
              commentId,
            },
          },
        });
        isLiked = !!userLike;
      }

      return {
        success: true,
        data: {
          likeCount,
          isLiked,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get likes for comment ${commentId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}

