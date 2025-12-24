import { Controller, Post, Body, UseGuards, Request, Get, Res, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard, RateLimit } from '../common/guards/rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private setRefreshTokenCookie(res: Response, refreshToken: string, isAdmin: boolean = false) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieName = isAdmin ? 'admin_refresh_token' : 'refresh_token';
    
    res.cookie(cookieName, refreshToken, {
      httpOnly: true,
      secure: isProduction, // Only send over HTTPS in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response, isAdmin: boolean = false) {
    const cookieName = isAdmin ? 'admin_refresh_token' : 'refresh_token';
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  @Post('signup')
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60) // 5 signups per minute
  async signup(@Body() signupDto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(signupDto);
    this.setRefreshTokenCookie(res, result.refresh_token);
    return {
      success: true,
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('login')
  @UseGuards(LocalAuthGuard, RateLimitGuard)
  @RateLimit(10, 60) // 10 login attempts per minute
  async login(@Request() req: any, @Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    this.setRefreshTokenCookie(res, result.refresh_token);
    return {
      success: true,
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('admin/login')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60) // 10 admin login attempts per minute
  async adminLogin(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.adminLogin(loginDto.email, loginDto.password);
    this.setRefreshTokenCookie(res, result.refresh_token, true);
    return {
      success: true,
      access_token: result.access_token,
      admin: result.admin,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const userId = req.body?.userId;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    if (!userId) {
      throw new UnauthorizedException('User ID required');
    }

    const result = await this.authService.refreshToken(refreshToken, userId);
    return {
      success: true,
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshAdmin(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.admin_refresh_token;
    const adminId = req.body?.adminId;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    if (!adminId) {
      throw new UnauthorizedException('Admin ID required');
    }

    const result = await this.authService.refreshAdminToken(refreshToken, adminId);
    return {
      success: true,
      access_token: result.access_token,
      admin: result.admin,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const userId = req.user?.id;

    if (refreshToken && userId) {
      await this.authService.logout(refreshToken, userId);
    }

    this.clearRefreshTokenCookie(res);
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Post('admin/logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async adminLogout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.admin_refresh_token;
    const adminId = req.user?.id;

    if (refreshToken && adminId) {
      await this.authService.adminLogout(refreshToken, adminId);
    }

    this.clearRefreshTokenCookie(res, true);
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return {
      success: true,
      data: req.user,
    };
  }
}
