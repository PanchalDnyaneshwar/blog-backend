import { Injectable, NotFoundException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SanitizeService } from '../common/services/sanitize.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private prisma: PrismaService,
    private sanitizeService: SanitizeService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async create(createCommentDto: CreateCommentDto, userId: number) {
    // Sanitize HTML content to prevent XSS attacks
    const sanitizedContent = this.sanitizeService.sanitizeHtml(createCommentDto.content);
    
    // Auto-approve comments for now (can be changed to require moderation)
    // Set approved: true to show comments immediately
    const comment = await this.prisma.comment.create({
      data: {
        ...createCommentDto,
        content: sanitizedContent,
        userId,
        approved: true, // Auto-approve comments
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Create notification if this is a reply to another comment
    if (createCommentDto.parentId && comment.parent) {
      const parentComment = comment.parent;
      // Don't notify if replying to own comment
      if (parentComment.userId !== userId) {
        try {
          await this.notificationsService.createCommentReplyNotification(
            parentComment.userId,
            comment.id,
            comment.post.slug,
            comment.post.title,
            comment.user.name,
          );
        } catch (error) {
          // Log error but don't fail comment creation
          this.logger.error(`Failed to create reply notification: ${error.message}`);
        }
      }
    }

    return {
      success: true,
      data: comment,
    };
  }

  async findAll(postId?: number, approved?: boolean) {
    const where: any = {};
    if (postId) {
      where.postId = postId;
    }
    if (approved !== undefined) {
      where.approved = approved;
    }

    const comments = await this.prisma.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        replies: {
          where: { approved: approved !== undefined ? approved : true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                likes: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only show approved replies and add likeCount
    const filteredComments = comments.map((comment) => ({
      ...comment,
      likeCount: comment._count?.likes || 0,
      replies: comment.replies
        .filter((reply) => approved === undefined || reply.approved === approved)
        .map((reply) => ({
          ...reply,
          likeCount: reply._count?.likes || 0,
        })),
    }));

    return {
      success: true,
      data: filteredComments,
    };
  }

  async findOne(id: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                likes: true,
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Add likeCount to comment and replies
    const commentWithLikes = {
      ...comment,
      likeCount: comment._count?.likes || 0,
      replies: comment.replies?.map((reply) => ({
        ...reply,
        likeCount: reply._count?.likes || 0,
      })) || [],
    };

    return {
      success: true,
      data: commentWithLikes,
    };
  }

  async update(id: number, updateCommentDto: UpdateCommentDto, userId: number, isAdmin: boolean = false) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only allow user to update their own comment, or admin to update any
    if (comment.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only update your own comments');
    }

    // Sanitize HTML content if content is being updated
    const updateData: any = { ...updateCommentDto };
    if (updateCommentDto.content) {
      updateData.content = this.sanitizeService.sanitizeHtml(updateCommentDto.content);
    }

    const updated = await this.prisma.comment.update({
      where: { id },
      data: updateData,
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
  }

  async remove(id: number, userId: number, isAdmin: boolean = false) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only allow user to delete their own comment, or admin to delete any
    if (comment.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Comment deleted successfully',
    };
  }

  async approve(id: number) {
    // Check if comment exists
    const existingComment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      throw new NotFoundException('Comment not found');
    }

    // Update comment to approved
    const comment = await this.prisma.comment.update({
      where: { id },
      data: { approved: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        post: {
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
      data: comment,
      message: 'Comment approved successfully',
    };
  }

  async reject(id: number) {
    // Check if comment exists
    const existingComment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      throw new NotFoundException('Comment not found');
    }

    // Delete the comment
    await this.prisma.comment.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Comment rejected and deleted',
    };
  }
}

