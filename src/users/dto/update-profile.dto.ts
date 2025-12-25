import { IsOptional, IsString, IsUrl, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Avatar must be a valid URL with protocol (http:// or https://)' })
  avatar?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Website must be a valid URL with protocol (http:// or https://)' })
  website?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/, {
    message: 'GitHub username must be valid (alphanumeric, hyphens allowed, 1-39 characters)',
  })
  github?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{1,15}$/, {
    message: 'Twitter username must be valid (alphanumeric and underscores, 1-15 characters)',
  })
  twitter?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'LinkedIn must be a valid URL with protocol (http:// or https://)' })
  linkedin?: string;
}

