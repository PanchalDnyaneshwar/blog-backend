import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class SubmitSolutionDto {
  @IsInt()
  @IsNotEmpty()
  problemId: number;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  language?: string; // Default: 'javascript'
}

