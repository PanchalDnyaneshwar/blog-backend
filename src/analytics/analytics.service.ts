import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getViewsOverTime(period: 'daily' | 'weekly' | 'monthly' = 'monthly', limit: number = 6) {
    const posts = await this.prisma.post.findMany({
      where: { published: true },
      select: {
        views: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    if (posts.length === 0) {
      return [];
    }

    // Group views by period
    const grouped: Record<string, number> = {};

    posts.forEach((post) => {
      const date = post.publishedAt || post.createdAt;
      if (!date) return;

      let key: string;
      const d = new Date(date);

      if (period === 'daily') {
        key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (period === 'weekly') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        // monthly
        key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      grouped[key] = (grouped[key] || 0) + (post.views || 0);
    });

    // Convert to array and sort
    // Create a mapping of date strings to Date objects for proper sorting
    const dateMap = new Map<string, Date>();
    Object.keys(grouped).forEach((key) => {
      // Try to parse the date string
      const parts = key.split(' ');
      if (parts.length >= 2) {
        // For "Jan 2024" or "Jan 15" format
        const dateStr = key;
        // Create a proper date for sorting
        try {
          dateMap.set(key, new Date(dateStr));
        } catch {
          // Fallback to current date if parsing fails
          dateMap.set(key, new Date());
        }
      } else {
        dateMap.set(key, new Date());
      }
    });

    const result = Object.entries(grouped)
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => {
        // Sort by date using the date map
        const dateA = dateMap.get(a.date) || new Date(0);
        const dateB = dateMap.get(b.date) || new Date(0);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-limit); // Get last N periods

    return result;
  }

  async getTopPosts(limit: number = 5) {
    const posts = await this.prisma.post.findMany({
      where: { published: true },
      select: {
        id: true,
        title: true,
        views: true,
        slug: true,
      },
      orderBy: { views: 'desc' },
      take: limit,
    });

    return posts.map((post) => ({
      title: post.title.length > 30 ? post.title.substring(0, 30) + '...' : post.title,
      views: post.views || 0,
      slug: post.slug,
    }));
  }

  async getCategoryDistribution() {
    const posts = await this.prisma.post.findMany({
      where: { published: true },
      select: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Count posts by category
    const categoryCounts: Record<string, number> = {};
    let total = 0;

    posts.forEach((post) => {
      const categoryName = post.category?.name || 'Uncategorized';
      categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
      total++;
    });

    if (total === 0) {
      return [];
    }

    // Convert to percentage and sort
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];
    let colorIndex = 0;

    const result = Object.entries(categoryCounts)
      .map(([name, count]) => {
        const percentage = Math.round((count / total) * 100);
        return {
          name,
          value: percentage,
          color: colors[colorIndex++ % colors.length],
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 categories

    return result;
  }

  async getOverallStats() {
    const [totalPosts, totalViews, totalUsers, publishedPosts] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.post.aggregate({
        where: { published: true },
        _sum: { views: true },
      }),
      this.prisma.user.count(),
      this.prisma.post.count({ where: { published: true } }),
    ]);

    const totalViewsSum = totalViews._sum.views || 0;
    const avgViews = publishedPosts > 0 ? Math.round(totalViewsSum / publishedPosts) : 0;

    return {
      totalPosts,
      publishedPosts,
      totalViews: totalViewsSum,
      totalUsers,
      avgViews,
    };
  }
}

