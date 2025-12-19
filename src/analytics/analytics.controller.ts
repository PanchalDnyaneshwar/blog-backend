import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview() {
    const stats = await this.analyticsService.getOverallStats();
    return { success: true, data: stats };
  }

  @Get('views-over-time')
  async getViewsOverTime(
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
    @Query('limit') limit?: string,
  ) {
    const data = await this.analyticsService.getViewsOverTime(
      period || 'monthly',
      limit ? parseInt(limit, 10) : 6,
    );
    return { success: true, data };
  }

  @Get('top-posts')
  async getTopPosts(@Query('limit') limit?: string) {
    const data = await this.analyticsService.getTopPosts(limit ? parseInt(limit, 10) : 5);
    return { success: true, data };
  }

  @Get('category-distribution')
  async getCategoryDistribution() {
    const data = await this.analyticsService.getCategoryDistribution();
    return { success: true, data };
  }
}

