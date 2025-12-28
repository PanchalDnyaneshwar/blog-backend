import { Controller, Get, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDto, SearchSuggestionsDto } from './dto/search.dto';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('search')
@UseGuards(RateLimitGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RateLimit(100, 60) // 100 requests per minute
  async search(@Query() searchDto: SearchDto) {
    try {
      return await this.searchService.search(searchDto);
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Search failed. Please try again.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('suggestions')
  @RateLimit(200, 60) // 200 requests per minute (more frequent for autocomplete)
  async getSuggestions(@Query() suggestionsDto: SearchSuggestionsDto) {
    try {
      return await this.searchService.getSuggestions(suggestionsDto);
    } catch (error) {
      // Return empty suggestions on error instead of throwing
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

  @Get('popular')
  @RateLimit(50, 60) // 50 requests per minute
  async getPopularSearches(@Query('limit') limit?: string) {
    try {
      return await this.searchService.getPopularSearches(limit ? parseInt(limit) : 10);
    } catch (error) {
      // Return empty result on error
      return {
        success: true,
        data: [],
      };
    }
  }
}

