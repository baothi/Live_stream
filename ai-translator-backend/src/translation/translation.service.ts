import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as FormData from 'form-data';
import axios from 'axios';

@Injectable()
export class TranslationService {
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY'),
    });
  }

  // ==========================================
  // BUOC 1: STT — Audio → Text tieng Viet
  // Dung OpenAI Whisper
  // ==========================================

  // Cac cau Whisper hay "hallucinate" khi nghe tieng on/am thanh nhe
  // (cau pho bien tren YouTube tieng Viet, Whisper da hoc qua nhieu)
  private readonly HALLUCINATION_BLACKLIST = [
    // YouTube closing phrases
    'hẹn gặp lại',
    'like và subscribe',
    'đăng ký kênh',
    'nhấn vào chuông',
    'cảm ơn các bạn đã xem',
    'cảm ơn các bạn đã theo dõi',
    'cảm ơn các bạn đã lắng nghe',
    'subscribe',
    'ủng hộ kênh',
    // YouTube caption/subtitle credits
    'phụ đề được thực hiện',
    'amara.org',
    'la la school',
    // Common filler from mic picking up other audio
    'xin chào các bạn',
    'chào mừng các bạn',
    'trong video hôm nay',
    'bắt đầu thôi',
  ];

  async speechToText(audioBuffer: Buffer): Promise<string> {
    const formData = new FormData();

    // Whisper can file, tao virtual file tu buffer
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });
    formData.append('model', 'whisper-1');
    // Khong force language: 'vi' de Whisper tu detect VI/EN mix (code-switching)
    // Vi du: "sao lúc e save nó báo sai benchmark nhỉ" → giu nguyen save, benchmark
    formData.append('response_format', 'text');

    // Prompt giup Whisper nhan dang dung ngu canh cuoc hop
    // va giam hallucination cac cau YouTube pho bien
    formData.append(
      'prompt',
      'Đây là cuộc họp trực tuyến. Người nói đang thảo luận về công việc và dự án.',
    );

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          Authorization: `Bearer ${this.config.get('OPENAI_API_KEY')}`,
          ...formData.getHeaders(),
        },
      },
    );

    const text: string = response.data?.trim() || '';

    // Loc bo cac cau hallucination pho bien
    const isHallucination = this.HALLUCINATION_BLACKLIST.some((phrase) =>
      text.toLowerCase().includes(phrase),
    );

    if (isHallucination) {
      console.log(`🚫 Whisper hallucination detected, ignored: "${text}"`);
      return '';
    }

    return text;
  }

  // ==========================================
  // BUOC 2: Dich VI → EN
  // Dung GPT-4o-mini (nhanh va re)
  // ==========================================
  async translate(vietnameseText: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a real-time interpreter for technical meetings. The speaker is Vietnamese and may mix Vietnamese with English (code-switching).

Rules:
- Translate Vietnamese parts to natural English
- Keep English words, technical terms, code, product names as-is (save, benchmark, deploy, API, bug, fix, merge, PR, etc.)
- Keep numbers, URLs, file names unchanged
- Result must be fluent, natural English as if a native speaker said it
- Translate only — no explanations, no notes
- If the entire text is already English, return as-is`,
        },
        {
          role: 'user',
          content: vietnameseText,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  // ==========================================
  // BUOC 3: TTS — Text EN → Audio
  // Uu tien ElevenLabs (co voice clone)
  // Fallback: OpenAI TTS
  // ==========================================
  async textToSpeech(text: string, voiceId?: string): Promise<Buffer> {
    // Neu user co voiceId → dung ElevenLabs (giong clone)
    if (voiceId && this.config.get('ELEVENLABS_API_KEY')) {
      return this.elevenLabsTTS(text, voiceId);
    }

    // Khong co → dung OpenAI TTS (giong mac dinh)
    return this.openaiTTS(text);
  }

  // ElevenLabs TTS voi giong clone
  private async elevenLabsTTS(
    text: string,
    voiceId: string,
  ): Promise<Buffer> {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        text,
        model_id: 'eleven_turbo_v2', // Nhanh nhat, phu hop realtime
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          'xi-api-key': this.config.get('ELEVENLABS_API_KEY'),
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      },
    );

    return Buffer.from(response.data);
  }

  // OpenAI TTS fallback
  private async openaiTTS(text: string): Promise<Buffer> {
    const response = await this.openai.audio.speech.create({
      model: 'tts-1', // tts-1-hd cho chat luong cao hon
      voice: 'nova', // alloy|echo|fable|onyx|nova|shimmer
      input: text,
      response_format: 'mp3',
      speed: 1.0,
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ==========================================
  // THEM VOICE CLONE: Upload giong len ElevenLabs
  // Goi khi user muon clone giong cua ho
  // ==========================================
  async cloneVoice(
    audioFiles: Buffer[],
    userName: string,
  ): Promise<string> {
    const formData = new FormData();
    formData.append('name', `${userName}_voice`);
    formData.append('description', `Cloned voice for ${userName}`);

    audioFiles.forEach((file, i) => {
      formData.append('files', file, {
        filename: `sample_${i}.mp3`,
        contentType: 'audio/mpeg',
      });
    });

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/voices/add',
      formData,
      {
        headers: {
          'xi-api-key': this.config.get('ELEVENLABS_API_KEY'),
          ...formData.getHeaders(),
        },
      },
    );

    return response.data.voice_id; // Tra ve voiceId de luu vao DB
  }
}
