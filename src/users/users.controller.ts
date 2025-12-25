import {
  Controller,
  Get,
  Param,
  Delete,
  Patch,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('users')
@UseGuards(RateLimitGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @Get('profile/:id')
  @RateLimit(100, 60)
  getPublicProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getPublicProfile(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @RateLimit(10, 60)
  updateMyProfile(@Request() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  /**
   * Export user data (GDPR Right to Access)
   * GET /users/me/export
   */
  @Get('me/export')
  async exportMyData(@Request() req: any, @Res() res: Response) {
    const userId = req.user.id;
    const result = await this.usersService.exportUserData(userId);

    // Set headers for JSON file download
    const filename = `user-data-export-${userId}-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send JSON data
    res.json(result.data);
  }

  /**
   * Delete my account (GDPR Right to Erasure)
   * DELETE /users/me
   */
  @Delete('me')
  async deleteMyAccount(@Request() req: any) {
    const userId = req.user.id;
    return this.usersService.deleteMyAccount(userId);
  }
}

