import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TranslationGateway } from './translation.gateway';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { UsersModule } from '../users/users.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
    }),
    // Multer cho file upload (clone voice)
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    }),
  ],
  providers: [TranslationGateway, TranslationService],
  controllers: [TranslationController], // FIX: them controller vao day
})
export class TranslationModule {}
