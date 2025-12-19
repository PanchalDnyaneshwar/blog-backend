import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    try {
      const settings = await this.settingsService.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch()
  async updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    try {
      const settings = await this.settingsService.updateSettings(updateSettingsDto);
      return { success: true, data: settings };
    } catch (error) {
      throw error;
    }
  }
}

