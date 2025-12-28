import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @RateLimit(20, 60) // 20 requests per minute
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    try {
      return await this.notificationsService.create(createNotificationDto);
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @RateLimit(100, 60) // 100 requests per minute
  async findAll(
    @Request() req: any,
    @Query('read') read?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      const readFilter = read === 'true' ? true : read === 'false' ? false : undefined;
      return await this.notificationsService.findAll(userId, {
        read: readFilter,
        page,
        limit,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get('unread-count')
  @RateLimit(200, 60) // 200 requests per minute
  async getUnreadCount(@Request() req: any) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.notificationsService.getUnreadCount(userId);
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  @RateLimit(100, 60)
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.notificationsService.findOne(id, userId);
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id')
  @RateLimit(100, 60)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.notificationsService.update(id, userId, updateNotificationDto);
    } catch (error) {
      throw error;
    }
  }

  @Patch('mark-all-read')
  @RateLimit(10, 60) // 10 requests per minute
  async markAllAsRead(@Request() req: any) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.notificationsService.markAllAsRead(userId);
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id')
  @RateLimit(100, 60)
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.notificationsService.delete(id, userId);
    } catch (error) {
      throw error;
    }
  }

  @Delete()
  @RateLimit(10, 60) // 10 requests per minute
  async deleteAll(
    @Request() req: any,
    @Query('readOnly', new ParseBoolPipe({ optional: true })) readOnly?: boolean,
  ) {
    try {
      const userId = req.user.userId || req.user.id;
      return await this.notificationsService.deleteAll(userId, readOnly);
    } catch (error) {
      throw error;
    }
  }
}

