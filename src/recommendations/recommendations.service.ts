import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Get content-based recommendations for a user
   * Based on reading history, bookmarks, and preferences
   */
  async getContentBasedRecommendations(userId: number, limit: number = 10) {
    try {
      // Validate inputs
      if (!userId || userId <= 0) {
        return {
          success: true,
          data: [],
        };
      }

      const validLimit = Math.min(Math.max(limit, 1), 20); // Clamp between 1 and 20
      const cacheKey = `recommendations:content-based:${userId}:${validLimit}`;
      
      // Try cache first
      try {
        const cached = await this.redis.getJSON<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        // Continue without cache if Redis fails
        this.logger.warn('Cache read failed, continuing without cache');
      }

    // Get user's reading history
    const readingHistory = await this.prisma.readingHistory.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            category: true,
            tags: true,
          },
        },
      },
      orderBy: { lastRead: 'desc' },
      take: 20, // Analyze last 20 reads
    });

    // Get user's bookmarks
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            category: true,
            tags: true,
          },
        },
      },
      take: 20,
    });

    // Extract preferences
    const categoryIds = new Set<number>();
    const tagIds = new Set<number>();
    const readPostIds = new Set<number>();

    readingHistory.forEach((rh) => {
      if (rh.post) {
        if (rh.post.categoryId) categoryIds.add(rh.post.categoryId);
        if (rh.post.tags) {
          rh.post.tags.forEach((tag) => tagIds.add(tag.id));
        }
        readPostIds.add(rh.postId);
      }
    });

    bookmarks.forEach((bm) => {
      if (bm.post) {
        if (bm.post.categoryId) categoryIds.add(bm.post.categoryId);
        if (bm.post.tags) {
          bm.post.tags.forEach((tag) => tagIds.add(tag.id));
        }
        readPostIds.add(bm.postId);
      }
    });

    // Build recommendation query
    const where: any = {
      published: true,
      id: { notIn: Array.from(readPostIds) },
    };

    // If user has preferences, use them; otherwise get popular posts
    if (categoryIds.size > 0 || tagIds.size > 0) {
      where.OR = [];
      
      if (categoryIds.size > 0) {
        where.OR.push({
          categoryId: { in: Array.from(categoryIds) },
        });
      }
      
      if (tagIds.size > 0) {
        where.OR.push({
          tags: {
            some: {
              id: { in: Array.from(tagIds) },
            },
          },
        });
      }
    }

    // Get recommended posts
    const recommendedPosts = await this.prisma.post.findMany({
      where,
      take: validLimit * 2, // Get more to score and filter
      include: {
        category: true,
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            bookmarks: true,
          },
        },
      },
      orderBy: [
        { views: 'desc' }, // Popularity
        { publishedAt: 'desc' }, // Recency
      ],
    });

    // Score posts based on relevance
    const scoredPosts = recommendedPosts.map((post) => {
      let score = 0;

      // Category match
      if (post.categoryId && categoryIds.has(post.categoryId)) {
        score += 10;
      }

      // Tag matches
      const matchingTags = post.tags.filter((tag) => tagIds.has(tag.id)).length;
      score += matchingTags * 5;

      // Popularity boost
      score += Math.min((post.views || 0) / 100, 5);
      score += Math.min((post._count?.bookmarks || 0) / 10, 3);

      // Recency boost (newer posts get slight boost)
      const daysSincePublished = Math.floor(
        (Date.now() - post.publishedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSincePublished < 30) {
        score += 2;
      }

      return {
        ...post,
        relevanceScore: score,
      };
    });

    // Sort by score and take top N
    const topRecommendations = scoredPosts
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, validLimit)
      .map(({ relevanceScore, ...post }) => {
        // Remove scoring field and _count if present
        const { _count, ...rest } = post as any;
        return rest;
      });

    const result = {
      success: true,
      data: topRecommendations,
    };

    // Cache for 1 hour
    try {
      await this.redis.setJSON(cacheKey, result, 3600);
    } catch (cacheError) {
      // Continue without caching if Redis fails
      this.logger.warn('Cache write failed, continuing without cache');
    }

    return result;
    } catch (error) {
      this.logger.error('Error getting content-based recommendations', error);
      return {
        success: true,
        data: [],
      };
    }
  }

  /**
   * Get popular posts for unauthenticated users
   */
  async getPopularPosts(limit: number = 10) {
    try {
      const validLimit = Math.min(Math.max(limit, 1), 20);
      const cacheKey = `recommendations:popular-posts:${validLimit}`;
      
      // Try cache first
      try {
        const cached = await this.redis.getJSON<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn('Cache read failed, continuing without cache');
      }

      const posts = await this.prisma.post.findMany({
        where: {
          published: true,
        },
        take: validLimit,
        include: {
          category: true,
          tags: true,
          author: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { views: 'desc' },
          { publishedAt: 'desc' },
        ],
      });

      const result = {
        success: true,
        data: posts,
      };

      // Cache for 30 minutes
      try {
        await this.redis.setJSON(cacheKey, result, 1800);
      } catch (cacheError) {
        this.logger.warn('Cache write failed, continuing without cache');
      }

      return result;
    } catch (error) {
      this.logger.error('Error getting popular posts', error);
      return {
        success: true,
        data: [],
      };
    }
  }

  /**
   * Get popular tutorials for unauthenticated users
   */
  async getPopularTutorials(limit: number = 5) {
    try {
      const validLimit = Math.min(Math.max(limit, 1), 10);
      const cacheKey = `recommendations:popular-tutorials:${validLimit}`;
      
      // Try cache first
      try {
        const cached = await this.redis.getJSON<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn('Cache read failed, continuing without cache');
      }

      const tutorials = await this.prisma.tutorial.findMany({
        where: {
          published: true,
        },
        take: validLimit,
        include: {
          lessons: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
      });

      const result = {
        success: true,
        data: tutorials,
      };

      // Cache for 30 minutes
      try {
        await this.redis.setJSON(cacheKey, result, 1800);
      } catch (cacheError) {
        this.logger.warn('Cache write failed, continuing without cache');
      }

      return result;
    } catch (error) {
      this.logger.error('Error getting popular tutorials', error);
      return {
        success: true,
        data: [],
      };
    }
  }

  /**
   * Get "Next to read" suggestions based on current reading progress
   */
  async getNextToRead(userId: number, limit: number = 5) {
    try {
      // Validate inputs
      if (!userId || userId <= 0) {
        return {
          success: true,
          data: [],
        };
      }

      const validLimit = Math.min(Math.max(limit, 1), 10); // Clamp between 1 and 10
      const cacheKey = `recommendations:next-to-read:${userId}:${validLimit}`;
      
      // Try cache first
      try {
        const cached = await this.redis.getJSON<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn('Cache read failed, continuing without cache');
      }

    // Get user's reading history with progress
    const readingHistory = await this.prisma.readingHistory.findMany({
      where: {
        userId,
        progress: { lt: 100 }, // Not fully read
      },
      include: {
        post: {
          include: {
            category: true,
            tags: true,
          },
        },
      },
      orderBy: { lastRead: 'desc' },
      take: validLimit,
    });

    // Get recently started tutorials
    const tutorialProgress = await this.prisma.userProgress.findMany({
      where: {
        userId,
        tutorialId: { not: null },
        lessonId: null,
        progressPercent: { gt: 0, lt: 100 },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: validLimit,
    });

    // Get tutorials for progress items
    const tutorialIds = tutorialProgress
      .map((tp) => tp.tutorialId)
      .filter((id): id is number => id !== null);

    const tutorials = tutorialIds.length > 0
      ? await this.prisma.tutorial.findMany({
          where: {
            id: { in: tutorialIds },
            published: true,
          },
          include: {
            lessons: {
              orderBy: { orderIndex: 'asc' },
              take: 1, // Just to show it has lessons
            },
          },
        })
      : [];

    // Combine and format
    const nextToRead = [
      ...readingHistory
        .filter((rh) => rh.post) // Filter out null posts
        .map((rh) => ({
          type: 'post' as const,
          id: rh.post!.id,
          title: rh.post!.title,
          slug: rh.post!.slug,
          excerpt: rh.post!.excerpt,
          featuredImage: rh.post!.featuredImage,
          category: rh.post!.category,
          tags: rh.post!.tags || [],
          progress: rh.progress,
          lastRead: rh.lastRead,
          link: `/blog/${rh.post!.slug}`,
        })),
      ...tutorials.map((tutorial) => {
        const progress = tutorialProgress.find((tp) => tp.tutorialId === tutorial.id);
        return {
          type: 'tutorial' as const,
          id: tutorial.id,
          title: tutorial.title,
          slug: tutorial.slug,
          description: tutorial.description,
          difficulty: tutorial.difficulty,
          progress: progress?.progressPercent || 0,
          lastRead: progress?.updatedAt || tutorial.updatedAt,
          link: `/tutorials/${tutorial.slug}`,
        };
      }),
    ]
      .sort((a, b) => b.lastRead.getTime() - a.lastRead.getTime())
      .slice(0, validLimit);

    const result = {
      success: true,
      data: nextToRead,
    };

    // Cache for 30 minutes
    try {
      await this.redis.setJSON(cacheKey, result, 1800);
    } catch (cacheError) {
      this.logger.warn('Cache write failed, continuing without cache');
    }

    return result;
    } catch (error) {
      this.logger.error('Error getting next-to-read recommendations', error);
      return {
        success: true,
        data: [],
      };
    }
  }

  /**
   * Get recommendations for a specific post
   */
  async getPostRecommendations(postId: number, limit: number = 5) {
    try {
      // Validate inputs
      if (!postId || postId <= 0) {
        return {
          success: true,
          data: [],
        };
      }

      const validLimit = Math.min(Math.max(limit, 1), 10); // Clamp between 1 and 10
      const cacheKey = `recommendations:post:${postId}:${validLimit}`;
      
      // Try cache first
      try {
        const cached = await this.redis.getJSON<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn('Cache read failed, continuing without cache');
      }

    // Get the post
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        category: true,
        tags: true,
      },
    });

    if (!post) {
      return {
        success: true,
        data: [],
      };
    }

    // Get posts with same category or tags
    const tagIds = post.tags.map((tag) => tag.id);
    const where: any = {
      published: true,
      id: { not: postId },
      OR: [],
    };

    if (post.categoryId) {
      where.OR.push({ categoryId: post.categoryId });
    }

    if (tagIds.length > 0) {
      where.OR.push({
        tags: {
          some: {
            id: { in: tagIds },
          },
        },
      });
    }

    // If no category or tags, get popular posts
    if (where.OR.length === 0) {
      delete where.OR;
    }

    const recommendations = await this.prisma.post.findMany({
      where,
      take: validLimit,
      include: {
        category: true,
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { views: 'desc' },
        { publishedAt: 'desc' },
      ],
    });

    const result = {
      success: true,
      data: recommendations,
    };

    // Cache for 1 hour
    try {
      await this.redis.setJSON(cacheKey, result, 3600);
    } catch (cacheError) {
      this.logger.warn('Cache write failed, continuing without cache');
    }

    return result;
    } catch (error) {
      this.logger.error('Error getting post recommendations', error);
      return {
        success: true,
        data: [],
      };
    }
  }

  /**
   * Get tutorial recommendations based on user progress
   */
  async getTutorialRecommendations(userId: number, limit: number = 5) {
    try {
      // Validate inputs
      if (!userId || userId <= 0) {
        return {
          success: true,
          data: [],
        };
      }

      const validLimit = Math.min(Math.max(limit, 1), 10); // Clamp between 1 and 10
      const cacheKey = `recommendations:tutorials:${userId}:${validLimit}`;
      
      // Try cache first
      try {
        const cached = await this.redis.getJSON<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn('Cache read failed, continuing without cache');
      }

    // Get user's completed tutorials
    const completedTutorials = await this.prisma.userProgress.findMany({
      where: {
        userId,
        tutorialId: { not: null },
        lessonId: null,
        progressPercent: 100,
      },
    });

    const completedIds = completedTutorials
      .map((ct) => ct.tutorialId)
      .filter((id): id is number => id !== null);

    // Get user's in-progress tutorials
    const inProgressTutorials = await this.prisma.userProgress.findMany({
      where: {
        userId,
        tutorialId: { not: null },
        lessonId: null,
        progressPercent: { gt: 0, lt: 100 },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const inProgressIds = inProgressTutorials
      .map((ipt) => ipt.tutorialId)
      .filter((id): id is number => id !== null);

    // Get recommended tutorials (not completed, not in progress)
    const excludeIds = [...completedIds, ...inProgressIds];

    const where: any = {
      published: true,
    };

    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    // If user has completed tutorials, recommend similar difficulty or next level
    let difficultyFilter = undefined;
    if (completedTutorials.length > 0) {
      // Get most common difficulty from completed tutorials
      const completedTutorialData = await this.prisma.tutorial.findMany({
        where: {
          id: { in: completedIds },
        },
        select: { difficulty: true },
      });

      const difficultyCounts = completedTutorialData.reduce((acc, t) => {
        acc[t.difficulty] = (acc[t.difficulty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostCommonDifficulty = Object.keys(difficultyCounts).reduce((a, b) =>
        difficultyCounts[a] > difficultyCounts[b] ? a : b,
      );

      // Recommend same or next level
      if (mostCommonDifficulty === 'BEGINNER') {
        difficultyFilter = ['BEGINNER', 'INTERMEDIATE'];
      } else if (mostCommonDifficulty === 'INTERMEDIATE') {
        difficultyFilter = ['INTERMEDIATE', 'ADVANCED'];
      } else {
        difficultyFilter = ['ADVANCED'];
      }
    }

    if (difficultyFilter) {
      where.difficulty = { in: difficultyFilter };
    }

    const recommendations = await this.prisma.tutorial.findMany({
      where,
      take: validLimit,
      include: {
        lessons: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

    const result = {
      success: true,
      data: recommendations,
    };

    // Cache for 1 hour
    try {
      await this.redis.setJSON(cacheKey, result, 3600);
    } catch (cacheError) {
      this.logger.warn('Cache write failed, continuing without cache');
    }

    return result;
    } catch (error) {
      this.logger.error('Error getting tutorial recommendations', error);
      return {
        success: true,
        data: [],
      };
    }
  }
}

