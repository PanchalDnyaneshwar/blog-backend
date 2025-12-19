import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    try {
      // Check if Settings model exists in Prisma
      if (!('settings' in this.prisma)) {
        // Return default settings if model doesn't exist
        return {
          id: 1,
          siteTitle: "Tech Blog",
          siteDescription: "Your destination for high-quality programming tutorials",
          siteUrl: "http://localhost:3000",
          adminEmail: "admin@example.com",
          defaultMetaTitle: "Tech Blog - Programming Tutorials",
          defaultMetaDescription: "Learn programming with our comprehensive tutorials",
          theme: "light",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      let settings = await this.prisma.settings.findFirst();
      if (!settings) {
        settings = await this.prisma.settings.create({
          data: {
            siteTitle: "Tech Blog",
            siteDescription: "Your destination for high-quality programming tutorials",
            siteUrl: "http://localhost:3000",
            adminEmail: "admin@example.com",
            defaultMetaTitle: "Tech Blog - Programming Tutorials",
            defaultMetaDescription: "Learn programming with our comprehensive tutorials",
            theme: "light",
          },
        });
      }
      return settings;
    } catch (error) {
      // Return default settings on error
      return {
        id: 1,
        siteTitle: "Tech Blog",
        siteDescription: "Your destination for high-quality programming tutorials",
        siteUrl: "http://localhost:3000",
        adminEmail: "admin@example.com",
        defaultMetaTitle: "Tech Blog - Programming Tutorials",
        defaultMetaDescription: "Learn programming with our comprehensive tutorials",
        theme: "light",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  async updateSettings(updateSettingsDto: UpdateSettingsDto) {
    try {
      // Check if Settings model exists
      if (!('settings' in this.prisma)) {
        throw new InternalServerErrorException('Settings model not available');
      }

      const settings = await this.prisma.settings.findFirst();
      if (!settings) {
        return this.prisma.settings.create({
          data: updateSettingsDto,
        });
      }
      return this.prisma.settings.update({
        where: { id: settings.id },
        data: updateSettingsDto,
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to update settings');
    }
  }
}

