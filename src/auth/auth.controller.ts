import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
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
  ) {}

  @Post('signup')
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60) // 5 signups per minute
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard, RateLimitGuard)
  @RateLimit(10, 60) // 10 login attempts per minute
  async login(@Request() req: any, @Body() loginDto: LoginDto) {
    // req.user is set by LocalAuthGuard after validation
    return this.authService.login(loginDto);
  }

  @Post('admin/login')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 60) // 10 admin login attempts per minute
  async adminLogin(@Body() loginDto: LoginDto) {
    return this.authService.adminLogin(loginDto.email, loginDto.password);
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
