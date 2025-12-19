import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

@Injectable()
export class MediaService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'media');
  private readonly publicUrl = process.env.MEDIA_PUBLIC_URL || `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/media`;

  constructor(private prisma: PrismaService) {
    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  async uploadFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only images are allowed.');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit.');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}-${randomString}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    // Save file
    try {
      fs.writeFileSync(filepath, file.buffer);
    } catch (error) {
      throw new BadRequestException('Failed to save file');
    }

    // Get image dimensions (optional, requires sharp or similar)
    const dimensions = await this.getImageDimensions(filepath);

    // Return file info
    return {
      id: timestamp,
      filename,
      originalName: file.originalname,
      url: `${this.publicUrl}/${filename}`,
      size: file.size,
      mimeType: file.mimetype,
      dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'Unknown',
      uploadedAt: new Date(),
    };
  }

  private async getImageDimensions(filepath: string): Promise<{ width: number; height: number } | null> {
    try {
      // Simple check - in production, use sharp or jimp for accurate dimensions
      const stats = await stat(filepath);
      // For now, return null - can be enhanced with image processing library
      return null;
    } catch {
      return null;
    }
  }

  async getAllFiles() {
    try {
      const files = await readdir(this.uploadDir);
      
      const fileInfos = await Promise.all(
        files.map(async (filename) => {
          const filepath = path.join(this.uploadDir, filename);
          try {
            const stats = await stat(filepath);
            return {
              id: parseInt(filename.split('-')[0]) || Date.now(),
              filename,
              name: filename,
              url: `${this.publicUrl}/${filename}`,
              size: this.formatFileSize(stats.size),
              dimensions: 'Unknown', // Can be enhanced with image processing
              uploadedAt: stats.birthtime,
            };
          } catch {
            return null;
          }
        })
      );

      return fileInfos.filter((info) => info !== null).sort((a, b) => {
        return new Date(b!.uploadedAt).getTime() - new Date(a!.uploadedAt).getTime();
      });
    } catch (error) {
      return [];
    }
  }

  async deleteFile(filename: string) {
    const filepath = path.join(this.uploadDir, filename);
    
    try {
      await stat(filepath);
      await unlink(filepath);
      return { success: true, message: 'File deleted successfully' };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw new BadRequestException('Failed to delete file');
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  getPublicUrl(): string {
    return this.publicUrl;
  }
}

