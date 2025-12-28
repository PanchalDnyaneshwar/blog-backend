import { IsOptional, IsString, IsInt, Min, Max, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchDto {
  @IsOptional()
  @IsString()
  q?: string; // Query string

  @IsOptional()
  @IsString()
  category?: string; // Category slug

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]; // Tag slugs

  @IsOptional()
  @IsString()
  author?: string; // Author name or email

  @IsOptional()
  @IsDateString()
  fromDate?: string; // Start date (ISO format)

  @IsOptional()
  @IsDateString()
  toDate?: string; // End date (ISO format)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 12;

  @IsOptional()
  @IsString()
  sort?: 'relevance' | 'date' | 'views' | 'title' = 'relevance';
}

export class SearchSuggestionsDto {
  @IsString()
  q: string; // Query string for suggestions

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}

