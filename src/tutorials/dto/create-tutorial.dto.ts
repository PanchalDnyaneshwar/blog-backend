import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsInt, Min } from 'class-validator';
import { Difficulty } from '@prisma/client';

export class CreateTutorialDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedTime?: number;

  @IsString()
  @IsOptional()
  introContent?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;
}

