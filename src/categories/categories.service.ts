import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: createCategoryDto,
    });

    // Invalidate cache
    await this.redis.invalidateCategoryCache();

    return {
      success: true,
      data: category,
    };
  }

  async findAll() {
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

    // Cache for 24 hours
    await this.redis.setJSON(cacheKey, result, 86400);

    return result;
  }

  async findOne(id: number) {
    const cacheKey = `category:id:${id}`;
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            posts: {
              where: { published: true },
            },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const result = {
      success: true,
      data: {
        ...category,
        count: category._count.posts,
      },
    };

    // Cache for 1 hour
    await this.redis.setJSON(cacheKey, result, 3600);

    return result;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    // Invalidate caches
    await this.redis.invalidateCategoryCache();
    await this.redis.del(`category:id:${id}`);

    return {
      success: true,
      data: category,
    };
  }

  async remove(id: number) {
    await this.prisma.category.delete({
      where: { id },
    });

    // Invalidate caches
    await this.redis.invalidateCategoryCache();
    await this.redis.del(`category:id:${id}`);

    return {
      success: true,
      message: 'Category deleted successfully',
    };
  }
}
