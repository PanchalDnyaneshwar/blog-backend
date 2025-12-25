import { IsInt, IsNotEmpty, IsOptional, Min, Max } from 'class-validator';

export class UpdateProgressDto {
  @IsInt()
  @IsOptional()
  tutorialId?: number;

  @IsInt()
  @IsOptional()
  lessonId?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  progressPercent: number;
}

