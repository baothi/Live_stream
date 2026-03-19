import {
  Controller,
  Post,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TranslationService } from './translation.service';
import { UsersService } from '../users/users.service';

@Controller('translation')
export class TranslationController {
  constructor(
    private translationService: TranslationService,
    private usersService: UsersService,
  ) {}

  // Upload audio mau de clone giong
  @UseGuards(JwtAuthGuard)
  @Post('clone-voice')
  @UseInterceptors(FilesInterceptor('files', 5))
  async cloneVoice(
    @Request() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const user = await this.usersService.findById(req.user.userId);
    const audioBuffers = files.map((f) => f.buffer);

    const voiceId = await this.translationService.cloneVoice(
      audioBuffers,
      user.name,
    );

    // Luu voiceId vao profile
    await this.usersService.updateVoiceId(req.user.userId, voiceId);

    return { success: true, voiceId, message: 'Clone giong thanh cong!' };
  }
}
