import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { memoryStorage } from 'multer';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Invalid file type. Only images are allowed.'), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const fileInfo = await this.mediaService.uploadFile(file);
    return {
      success: true,
      data: fileInfo,
    };
  }

  @Get()
  async getAllFiles() {
    const files = await this.mediaService.getAllFiles();
    return {
      success: true,
      data: files,
    };
  }

  @Delete(':filename')
  async deleteFile(@Param('filename') filename: string) {
    await this.mediaService.deleteFile(filename);
    return {
      success: true,
      message: 'File deleted successfully',
    };
  }
}

