import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NewsletterService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async subscribe(email: string, name?: string) {
    // Check if already subscribed
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.active) {
        throw new BadRequestException('Email is already subscribed');
      } else {
        // Reactivate subscription
        await this.prisma.newsletterSubscriber.update({
          where: { email },
          data: { active: true },
        });
      }
    } else {
      // Create new subscription
      await this.prisma.newsletterSubscriber.create({
        data: {
          email,
          name: name || null,
          active: true,
        },
      });
    }

    // Send welcome email
    await this.emailService.sendNewsletterWelcomeEmail(email, name);

    return {
      success: true,
      message: 'Successfully subscribed to newsletter!',
    };
  }

  async unsubscribe(email: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (!subscriber) {
      throw new BadRequestException('Email not found in newsletter');
    }

    await this.prisma.newsletterSubscriber.update({
      where: { email },
      data: { active: false },
    });

    return {
      success: true,
      message: 'Successfully unsubscribed from newsletter',
    };
  }
}

