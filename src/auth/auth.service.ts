import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.validateUser(loginDto.email, loginDto.password);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return await this.generateTokens(user);
    } catch (error: any) {
      // Re-throw known exceptions
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Log and wrap unexpected errors
      console.error('Login service error:', error);
      throw new BadRequestException(`Login failed: ${error.message || 'Unknown error'}`);
    }
  }

  private async generateTokens(user: any) {
    // Validate JWT_SECRET is configured
    const jwtSecret = this.configService.get('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured. Please set JWT_SECRET in your .env file.');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    
    // Generate access token (short-lived: 15 minutes)
    let accessToken: string;
    try {
      accessToken = this.jwtService.sign(payload, {
        expiresIn: '15m',
      });
    } catch (error: any) {
      throw new Error(`Failed to generate access token: ${error.message}`);
    }

    // Generate refresh token (long-lived: 7 days)
    const refreshToken = crypto.randomBytes(32).toString('hex');
    
    // Store refresh token in Redis (7 days TTL) - gracefully handle Redis failures
    const refreshTokenKey = `refresh_token:${user.id}:${refreshToken}`;
    try {
      await this.redis.set(refreshTokenKey, JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role,
      }), 7 * 24 * 60 * 60); // 7 days
    } catch (error: any) {
      // Log but don't fail login if Redis is unavailable
      console.warn('Failed to store refresh token in Redis:', error.message);
      // Continue without Redis - tokens will still work, just won't be stored
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string, userId: number) {
    // Verify refresh token exists in Redis
    const refreshTokenKey = `refresh_token:${userId}:${refreshToken}`;
    const tokenData = await this.redis.get(refreshTokenKey);

    if (!tokenData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userData = JSON.parse(tokenData);
    
    // Get fresh user data from database
    const user = await this.prisma.user.findUnique({
      where: { id: userData.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new tokens
    return this.generateTokens(user);
  }

  async logout(refreshToken: string, userId: number) {
    // Remove refresh token from Redis
    const refreshTokenKey = `refresh_token:${userId}:${refreshToken}`;
    await this.redis.del(refreshTokenKey);
    return { success: true, message: 'Logged out successfully' };
  }

  async signup(signupDto: SignupDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 12);
    
    // Generate email verification token
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpiry = new Date();
    emailVerifyExpiry.setHours(emailVerifyExpiry.getHours() + 24); // 24 hours expiry

    const user = await this.prisma.user.create({
      data: {
        email: signupDto.email,
        name: signupDto.name,
        password: hashedPassword,
        emailVerified: false,
        emailVerifyToken,
        emailVerifyExpiry,
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      emailVerifyToken,
      user.name,
    );

    const { password: _, ...result } = user;
    return {
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      user: result,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: verifyEmailDto.token,
        emailVerifyExpiry: {
          gt: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Update user as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: requestPasswordResetDto.email },
    });

    // Don't reveal if user exists (security best practice)
    if (!user) {
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.name,
    );

    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: resetPasswordDto.token,
        resetTokenExpiry: {
          gt: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 12);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  async validateAdmin(email: string, password: string): Promise<any> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (admin && (await bcrypt.compare(password, admin.password))) {
      const { password: _, ...result } = admin;
      return result;
    }
    return null;
  }

  async adminLogin(email: string, password: string) {
    const admin = await this.validateAdmin(email, password);
    if (!admin) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const payload = { email: admin.email, sub: admin.id, role: admin.role };
    
    // Generate access token (15 minutes)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // Generate refresh token for admin
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenKey = `refresh_token:admin:${admin.id}:${refreshToken}`;
    await this.redis.set(refreshTokenKey, JSON.stringify({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
      isAdmin: true,
    }), 7 * 24 * 60 * 60); // 7 days

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async refreshAdminToken(refreshToken: string, adminId: number) {
    const refreshTokenKey = `refresh_token:admin:${adminId}:${refreshToken}`;
    const tokenData = await this.redis.get(refreshTokenKey);

    if (!tokenData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const adminData = JSON.parse(tokenData);
    
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminData.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const payload = { email: admin.email, sub: admin.id, role: admin.role };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    return {
      access_token: accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async adminLogout(refreshToken: string, adminId: number) {
    const refreshTokenKey = `refresh_token:admin:${adminId}:${refreshToken}`;
    await this.redis.del(refreshTokenKey);
    return { success: true, message: 'Logged out successfully' };
  }
}

