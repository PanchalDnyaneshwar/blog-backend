import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsInt, Min, IsArray, IsObject } from 'class-validator';
import { Difficulty } from '@prisma/client';

export class CreateProblemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  constraints?: string;

  @IsObject()
  @IsOptional()
  examples?: any; // Array of example inputs/outputs

  @IsString()
  @IsOptional()
  starterCode?: string;

  @IsString()
  @IsOptional()
  solution?: string;

  @IsObject()
  @IsOptional()
  hints?: any; // Array of hints

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  timeLimit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  memoryLimit?: number;
}

