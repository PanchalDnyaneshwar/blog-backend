import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsObject } from 'class-validator';

export class CreateLessonDto {
  @IsInt()
  @IsNotEmpty()
  tutorialId: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsObject()
  @IsNotEmpty()
  content: any; // JSON content blocks

  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedTime?: number;

  @IsObject()
  @IsOptional()
  metadata?: any; // Additional metadata as JSON
}

