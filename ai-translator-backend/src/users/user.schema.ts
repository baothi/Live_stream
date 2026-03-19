import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: 'free' })
  plan: string; // free | pro | enterprise

  @Prop({ default: true })
  isActive: boolean;

  // ElevenLabs Voice ID (sau khi user clone giong)
  @Prop({ default: null })
  voiceId: string;

  // Cho phep user dung key rieng (optional)
  @Prop({ default: null })
  openaiKey: string;

  @Prop({ default: null })
  elevenLabsKey: string;

  // Thong ke usage
  @Prop({ default: 0 })
  totalMinutesUsed: number;

  @Prop({ default: 0 })
  totalSentencesTranslated: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
