import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(createTagDto: CreateTagDto) {
    const tag = await this.prisma.tag.create({
      data: createTagDto,
    });

    // Invalidate cache
    await this.redis.invalidateTagCache();

    return {
      success: true,
      data: tag,
    };
  }

  async findAll() {
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

    // Cache for 24 hours
    await this.redis.setJSON(cacheKey, result, 86400);

    return result;
  }

  async findOne(id: number) {
    const cacheKey = `tag:id:${id}`;
    
    // Try to get from cache
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const tag = await this.prisma.tag.findUnique({
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

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    const result = {
      success: true,
      data: {
        ...tag,
        count: tag._count.posts,
      },
    };

    // Cache for 1 hour
    await this.redis.setJSON(cacheKey, result, 3600);

    return result;
  }

  async update(id: number, updateTagDto: UpdateTagDto) {
    const tag = await this.prisma.tag.update({
      where: { id },
      data: updateTagDto,
    });

    // Invalidate caches
    await this.redis.invalidateTagCache();
    await this.redis.del(`tag:id:${id}`);

    return {
      success: true,
      data: tag,
    };
  }

  async remove(id: number) {
    await this.prisma.tag.delete({
      where: { id },
    });

    // Invalidate caches
    await this.redis.invalidateTagCache();
    await this.redis.del(`tag:id:${id}`);

    return {
      success: true,
      message: 'Tag deleted successfully',
    };
  }
}
