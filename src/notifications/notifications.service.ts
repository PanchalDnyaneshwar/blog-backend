import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createNotificationDto: CreateNotificationDto) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: createNotificationDto.userId,
          type: createNotificationDto.type,
          title: createNotificationDto.title,
          message: createNotificationDto.message,
          link: createNotificationDto.link,
          metadata: createNotificationDto.metadata || {},
        },
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
        data: notification,
      };
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(userId: number, options?: { read?: boolean; limit?: number; page?: number }) {
    try {
      const { read, limit = 20, page = 1 } = options || {};
      const skip = (page - 1) * limit;

      const where: any = { userId };
      if (read !== undefined) {
        where.read = read;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({
          where: { userId, read: false },
        }),
      ]);

      return {
        success: true,
        data: notifications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total,
          hasNext: skip + limit < total,
          hasPrev: page > 1,
        },
        unreadCount,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: number, userId: number) {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return {
        success: true,
        data: notification,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: number, userId: number, updateNotificationDto: UpdateNotificationDto) {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      const updateData: any = {};
      if (updateNotificationDto.read !== undefined) {
        updateData.read = updateNotificationDto.read;
        if (updateNotificationDto.read && !notification.read) {
          updateData.readAt = new Date();
        }
      }

      const updated = await this.prisma.notification.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markAllAsRead(userId: number) {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          count: result.count,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to mark all as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  async delete(id: number, userId: number) {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      await this.prisma.notification.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteAll(userId: number, readOnly: boolean = false) {
    try {
      const where: any = { userId };
      if (readOnly) {
        where.read = true;
      }

      const result = await this.prisma.notification.deleteMany({
        where,
      });

      return {
        success: true,
        data: {
          count: result.count,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to delete notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUnreadCount(userId: number) {
    try {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      return {
        success: true,
        data: { count },
      };
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Helper method to create comment reply notification
  async createCommentReplyNotification(
    recipientId: number,
    commentId: number,
    postSlug: string,
    postTitle: string,
    authorName: string,
  ) {
    return this.create({
      userId: recipientId,
      type: NotificationType.COMMENT_REPLY,
      title: 'New Reply to Your Comment',
      message: `${authorName} replied to your comment on "${postTitle}"`,
      link: `/blog/${postSlug}#comment-${commentId}`,
      metadata: {
        commentId,
        postSlug,
        authorName,
      },
    });
  }

  // Helper method to create post published notification
  async createPostPublishedNotification(
    userId: number,
    postSlug: string,
    postTitle: string,
    categoryName?: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.POST_PUBLISHED,
      title: 'New Post Published',
      message: categoryName
        ? `A new post "${postTitle}" was published in ${categoryName}`
        : `A new post "${postTitle}" was published`,
      link: `/blog/${postSlug}`,
      metadata: {
        postSlug,
        categoryName,
      },
    });
  }
}

