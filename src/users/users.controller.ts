import { Controller, Get, Param, Delete, Query, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
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

