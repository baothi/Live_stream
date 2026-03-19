import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(data: { name: string; email: string; password: string }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = new this.userModel({ ...data, password: hashedPassword });
    return user.save();
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string) {
    return this.userModel.findById(id).select('-password');
  }

  async updateVoiceId(userId: string, voiceId: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { voiceId },
      { new: true },
    );
  }

  async updateUsageStats(userId: string, sentences: number) {
    return this.userModel.findByIdAndUpdate(userId, {
      $inc: {
        totalSentencesTranslated: sentences,
      },
    });
  }

  async getAllUsers() {
    return this.userModel.find().select('-password');
  }
}
