import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SanitizeService } from '../common/services/sanitize.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class BlogService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private sanitizeService: SanitizeService,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sort?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 12, 100);
    const skip = (page - 1) * limit;

    // Build cache key based on query parameters
    const cacheKey = `posts:list:page:${page}:limit:${limit}:category:${query.category || 'all'}:search:${query.search || 'none'}:sort:${query.sort || 'default'}`;
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build where clause
    const where: any = { published: true };

    if (query.category) {
      where.category = { slug: query.category };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    let orderBy: any = { publishedAt: 'desc' };
    if (query.sort === 'views') {
      orderBy = { views: 'desc' };
    } else if (query.sort === 'title') {
      orderBy = { title: 'asc' };
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
            },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    const result = {
      success: true,
      data: posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };

    // Cache for 15 minutes (shorter for lists as they change more frequently)
    await this.redis.setJSON(cacheKey, result, 900);

    return result;
  }

  async findOne(slug: string) {
    const cacheKey = `post:${slug}`;
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const post = await this.prisma.post.findUnique({
      where: { slug, published: true },
      include: {
        category: true,
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Increment views (don't cache this, update DB directly)
    await this.prisma.post.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
    });

    const result = {
      success: true,
      data: { ...post, views: post.views + 1 },
    };

    // Cache for 1 hour
    await this.redis.setJSON(cacheKey, result, 3600);

    return result;
  }

  async getCategories() {
    const cacheKey = 'categories:all';
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: {
            posts: {
              where: { published: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = categories.map((cat) => ({
      ...cat,
      count: cat._count.posts,
    }));

    const result = {
      success: true,
      data: formatted,
    };

    // Cache for 24 hours (categories don't change often)
    await this.redis.setJSON(cacheKey, result, 86400);

    return result;
  }

  async getTags() {
    const cacheKey = 'tags:all';
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const tags = await this.prisma.tag.findMany({
      include: {
        _count: {
          select: {
            posts: {
              where: { published: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = tags.map((tag) => ({
      ...tag,
      count: tag._count.posts,
    }));

    const result = {
      success: true,
      data: formatted,
    };

    // Cache for 24 hours (tags don't change often)
    await this.redis.setJSON(cacheKey, result, 86400);

    return result;
  }

  async getRelatedPosts(excludeId?: number, categoryId?: number, limit = 3) {
    const cacheKey = `posts:related:exclude:${excludeId || 'none'}:category:${categoryId || 'none'}:limit:${limit}`;
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {
      published: true,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const posts = await this.prisma.post.findMany({
      where,
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: {
        category: true,
        tags: true,
      },
    });

    const result = {
      success: true,
      data: posts,
    };

    // Cache for 30 minutes
    await this.redis.setJSON(cacheKey, result, 1800);

    return result;
  }

  // Admin methods
  async create(createPostDto: CreatePostDto, authorId: number) {
    const { tagIds, ...postData } = createPostDto;
    
    // Sanitize HTML content (rich text editor content)
    const sanitizedData = {
      ...postData,
      content: this.sanitizeService.sanitizeRichText(postData.content),
      excerpt: postData.excerpt ? this.sanitizeService.sanitizeText(postData.excerpt) : undefined,
      metaTitle: postData.metaTitle ? this.sanitizeService.sanitizeText(postData.metaTitle) : undefined,
      metaDescription: postData.metaDescription ? this.sanitizeService.sanitizeText(postData.metaDescription) : undefined,
      metaKeywords: postData.metaKeywords ? this.sanitizeService.sanitizeText(postData.metaKeywords) : undefined,
    };
    
    const post = await this.prisma.post.create({
      data: {
        ...sanitizedData,
        authorId,
        publishedAt: createPostDto.published ? new Date() : null,
        tags: tagIds ? {
          connect: tagIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        category: true,
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Invalidate all related caches
    await this.redis.invalidatePostCache(post.slug);

    return {
      success: true,
      data: post,
    };
  }

  async update(id: number, updatePostDto: UpdatePostDto) {
    const { tagIds, ...postData } = updatePostDto;
    
    // Get old post to invalidate cache
    const oldPost = await this.prisma.post.findUnique({
      where: { id },
      select: { slug: true },
    });
    
    // Sanitize HTML content if being updated
    const updateData: any = {
      ...postData,
      publishedAt: updatePostDto.published ? new Date() : undefined,
    };

    // Sanitize content fields if they're being updated
    if (updateData.content) {
      updateData.content = this.sanitizeService.sanitizeRichText(updateData.content);
    }
    if (updateData.excerpt) {
      updateData.excerpt = this.sanitizeService.sanitizeText(updateData.excerpt);
    }
    if (updateData.metaTitle) {
      updateData.metaTitle = this.sanitizeService.sanitizeText(updateData.metaTitle);
    }
    if (updateData.metaDescription) {
      updateData.metaDescription = this.sanitizeService.sanitizeText(updateData.metaDescription);
    }
    if (updateData.metaKeywords) {
      updateData.metaKeywords = this.sanitizeService.sanitizeText(updateData.metaKeywords);
    }

    if (tagIds !== undefined) {
      // Replace all tags with new ones
      updateData.tags = {
        set: tagIds.map(id => ({ id })),
      };
    }

    const post = await this.prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.redis.invalidatePostCache(oldPost?.slug);
    if (post.slug !== oldPost?.slug) {
      await this.redis.invalidatePostCache(post.slug);
    }

    return {
      success: true,
      data: post,
    };
  }

  async remove(id: number) {
    const post = await this.prisma.post.delete({
      where: { id },
    });

    // Invalidate caches
    await this.redis.invalidatePostCache(post.slug);

    return {
      success: true,
      message: 'Post deleted successfully',
    };
  }

  async getPostById(id: number) {
    const cacheKey = `post:id:${id}`;
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        category: true,
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const result = {
      success: true,
      data: post,
    };

    // Cache for 1 hour
    await this.redis.setJSON(cacheKey, result, 3600);

    return result;
  }
}
