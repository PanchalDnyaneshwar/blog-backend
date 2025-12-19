import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  content: string;

  @IsInt()
  postId: number;

  @IsOptional()
  @IsInt()
  parentId?: number;
}

