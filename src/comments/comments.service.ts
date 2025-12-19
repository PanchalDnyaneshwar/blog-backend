import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(createCommentDto: CreateCommentDto, userId: number) {
    // Auto-approve comments for now (can be changed to require moderation)
    // Set approved: true to show comments immediately
    const comment = await this.prisma.comment.create({
      data: {
        ...createCommentDto,
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
      },
    });

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
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only show approved replies
    const filteredComments = comments.map((comment) => ({
      ...comment,
      replies: comment.replies.filter((reply) => approved === undefined || reply.approved === approved),
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
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return {
      success: true,
      data: comment,
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

    const updated = await this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
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

