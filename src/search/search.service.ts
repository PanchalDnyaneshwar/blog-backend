import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SearchDto, SearchSuggestionsDto } from './dto/search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async search(searchDto: SearchDto) {
    try {
      const {
      q,
      category,
      tags,
      author,
      fromDate,
      toDate,
      page = 1,
      limit = 12,
      sort = 'relevance',
    } = searchDto;

    const skip = (page - 1) * limit;

    // Build cache key
    const cacheKey = `search:${JSON.stringify(searchDto)}`;
    
    // Try to get from cache
    try {
      const cached = await this.redis.getJSON<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (cacheError) {
      this.logger.warn(`Cache read failed for search: ${cacheError.message}`);
    }

    // Build where clause
    const where: any = { published: true };

    // Search query - full-text search across multiple fields
    if (q && q.trim()) {
      const searchTerm = q.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { excerpt: { contains: searchTerm, mode: 'insensitive' } },
        { content: { contains: searchTerm, mode: 'insensitive' } },
        { metaKeywords: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category) {
      where.category = { slug: category };
    }

    // Tags filter
    if (tags && tags.length > 0) {
      where.tags = {
        some: {
          slug: { in: tags },
        },
      };
    }

    // Author filter
    if (author) {
      where.author = {
        OR: [
          { name: { contains: author, mode: 'insensitive' } },
          { email: { contains: author, mode: 'insensitive' } },
        ],
      };
    }

    // Date range filter
    if (fromDate || toDate) {
      where.publishedAt = {};
      if (fromDate) {
        where.publishedAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.publishedAt.lte = new Date(toDate);
      }
    }

    // Build orderBy based on sort option
    let orderBy: any = { publishedAt: 'desc' };
    if (sort === 'relevance' && q) {
      // For relevance, we'll use a combination of title match and date
      // PostgreSQL full-text search would be better, but this works for now
      orderBy = [
        { publishedAt: 'desc' },
        { views: 'desc' },
      ];
    } else if (sort === 'views') {
      orderBy = { views: 'desc' };
    } else if (sort === 'title') {
      orderBy = { title: 'asc' };
    } else if (sort === 'date') {
      orderBy = { publishedAt: 'desc' };
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          tags: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    // Calculate relevance score for posts (if search query exists)
    let scoredPosts: Array<any & { relevanceScore?: number }> = posts;
    if (q && q.trim()) {
      const searchTerm = q.trim().toLowerCase();
      scoredPosts = posts.map((post) => {
        let score = 0;
        const titleLower = post.title.toLowerCase();
        const excerptLower = post.excerpt?.toLowerCase() || '';
        const contentLower = post.content.toLowerCase();

        // Title match gets highest score
        if (titleLower.includes(searchTerm)) {
          score += 100;
          // Exact match gets bonus
          if (titleLower === searchTerm) {
            score += 50;
          }
        }

        // Excerpt match gets medium score
        if (excerptLower.includes(searchTerm)) {
          score += 30;
        }

        // Content match gets lower score
        if (contentLower.includes(searchTerm)) {
          score += 10;
        }

        // Tag match gets bonus
        if (post.tags.some((tag) => tag.name.toLowerCase().includes(searchTerm))) {
          score += 20;
        }

        return { ...post, relevanceScore: score };
      });

      // Sort by relevance score if relevance sort is selected
      if (sort === 'relevance') {
        scoredPosts.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      }
    }

    const result = {
      success: true,
      data: scoredPosts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
      query: {
        q: q || '',
        category: category || null,
        tags: tags || [],
        author: author || null,
        fromDate: fromDate || null,
        toDate: toDate || null,
        sort,
      },
    };

    // Cache for 5 minutes (search results change frequently)
    try {
      await this.redis.setJSON(cacheKey, result, 300);
    } catch (cacheError) {
      this.logger.warn(`Cache write failed for search: ${cacheError.message}`);
    }

      return result;
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSuggestions(suggestionsDto: SearchSuggestionsDto) {
    try {
    const { q, limit = 5 } = suggestionsDto;

    if (!q || q.trim().length < 2) {
      return {
        success: true,
        data: {
          posts: [],
          categories: [],
          tags: [],
        },
      };
    }

      const searchTerm = q.trim();
      const cacheKey = `search:suggestions:${searchTerm}:${limit}`;

      // Try to get from cache
      try {
        const cached = await this.redis.getJSON<any>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn(`Cache read failed for suggestions: ${cacheError.message}`);
      }

    // Search posts by title
    const posts = await this.prisma.post.findMany({
      where: {
        published: true,
        title: { contains: searchTerm, mode: 'insensitive' },
      },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    // Search categories
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { slug: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    // Search tags
    const tags = await this.prisma.tag.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { slug: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    const result = {
      success: true,
      data: {
        posts,
        categories,
        tags,
      },
    };

      // Cache for 10 minutes
      try {
        await this.redis.setJSON(cacheKey, result, 600);
      } catch (cacheError) {
        this.logger.warn(`Cache write failed for suggestions: ${cacheError.message}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Get suggestions failed: ${error.message}`, error.stack);
      // Return empty result on error instead of throwing
      return {
        success: false,
        data: {
          posts: [],
          categories: [],
          tags: [],
        },
      };
    }
  }

  async getPopularSearches(limit = 10) {
    try {
      const cacheKey = `search:popular:${limit}`;

      // Try to get from cache
      try {
        const cached = await this.redis.getJSON<string[]>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
          };
        }
      } catch (cacheError) {
        this.logger.warn(`Cache read failed for popular searches: ${cacheError.message}`);
      }

      // For now, return empty array
      // In production, you'd track search queries and return most popular ones
      const result = {
        success: true,
        data: [],
      };

      // Cache for 1 hour
      try {
        await this.redis.setJSON(cacheKey, result.data, 3600);
      } catch (cacheError) {
        this.logger.warn(`Cache write failed for popular searches: ${cacheError.message}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Get popular searches failed: ${error.message}`, error.stack);
      // Return empty result on error
      return {
        success: true,
        data: [],
      };
    }
  }
}

