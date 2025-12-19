import { Module } from '@nestjs/common';
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
import { AppController } from './app.controller';

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
  ],
  controllers: [AppController],
})
export class AppModule {}

