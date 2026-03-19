import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    // Kiem tra email ton tai chua
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email da duoc su dung');

    const user = await this.usersService.create({ name, email, password });

    const payload = { sub: (user as any)._id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: (user as any)._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user)
      throw new UnauthorizedException('Email hoac mat khau khong dung');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      throw new UnauthorizedException('Email hoac mat khau khong dung');

    if (!user.isActive)
      throw new UnauthorizedException('Tai khoan da bi khoa');

    const payload = { sub: (user as any)._id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: (user as any)._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        voiceId: user.voiceId,
      },
    };
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }
}
