import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Lay profile cua user dang login
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  // Admin: lay tat ca users
  @UseGuards(JwtAuthGuard)
  @Get('all')
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  // Cap nhat Voice ID sau khi clone giong
  @UseGuards(JwtAuthGuard)
  @Put('voice-id')
  async updateVoiceId(
    @Request() req,
    @Body() body: { voiceId: string },
  ) {
    return this.usersService.updateVoiceId(req.user.userId, body.voiceId);
  }
}
