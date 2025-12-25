import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BlogModule } from './blog/blog.module';
import { UsersModule } from './users/users.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { RedisModule } from './redis/redis.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { CommentsModule } from './comments/comments.module';
import { ReadingHistoryModule } from './reading-history/reading-history.module';
import { CommonModule } from './common/common.module';
import { SettingsModule } from './settings/settings.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MediaModule } from './media/media.module';
import { EmailModule } from './email/email.module';
import { TutorialsModule } from './tutorials/tutorials.module';
import { ProblemsModule } from './problems/problems.module';
import { ProgressModule } from './progress/progress.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AppController } from './app.controller';
import { CsrfGuard } from './common/guards/csrf.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
    AuthModule,
    BlogModule,
    UsersModule,
    BookmarksModule,
    CategoriesModule,
    TagsModule,
        CommentsModule,
        ReadingHistoryModule,
        SettingsModule,
        AnalyticsModule,
        MediaModule,
        EmailModule,
        TutorialsModule,
        ProblemsModule,
        ProgressModule,
        RecommendationsModule,
      ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}

