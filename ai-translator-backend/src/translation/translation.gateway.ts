import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { JwtService } from '@nestjs/jwt';
import { TranslationService } from './translation.service';
import { UsersService } from '../users/users.service';
import { IncomingMessage } from 'http';

// Interface cho WebSocket voi them thuoc tinh
interface AuthenticatedWebSocket extends WebSocket {
  isAlive?: boolean;
}

@WebSocketGateway({
  path: '/translation',
  cors: { origin: '*' },
})
export class TranslationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map tung client voi thong tin user
  private clients = new Map<
    any,
    { userId: string; voiceId: string | null }
  >();

  constructor(
    private jwtService: JwtService,
    private translationService: TranslationService,
    private usersService: UsersService,
  ) {}

  // ==========================================
  // Khi client ket noi — xac thuc JWT
  // ==========================================
  async handleConnection(client: any, ...args: any[]) {
    try {
      // Lay URL tu request
      const req = args[0] as IncomingMessage;
      const url = new URL(req?.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        client.close(1008, 'Thieu token');
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        client.close(1008, 'User khong ton tai');
        return;
      }

      this.clients.set(client, {
        userId: (user as any)._id.toString(),
        voiceId: user.voiceId || null,
      });

      console.log(`✅ User connected: ${user.email}`);

      // Xu ly message tu client (raw WebSocket)
      client.on('message', (data: Buffer) => {
        this.handleIncomingMessage(client, data);
      });
    } catch (err) {
      console.error('Connection error:', err.message);
      client.close(1008, 'Token khong hop le');
    }
  }

  // ==========================================
  // Khi client ngat ket noi
  // ==========================================
  handleDisconnect(client: any) {
    const info = this.clients.get(client);
    if (info) {
      console.log(`❌ User disconnected: ${info.userId}`);
      this.clients.delete(client);
    }
  }

  // ==========================================
  // Nhan audio WAV tu Extension va xu ly pipeline
  // ==========================================
  private async handleIncomingMessage(client: any, data: Buffer) {
    const info = this.clients.get(client);
    if (!info) return;

    try {
      // 1. STT: Audio VI → Text VI (Whisper)
      const vietnameseText =
        await this.translationService.speechToText(data);
      if (!vietnameseText || vietnameseText.trim().length < 2) return;

      console.log(`🎙️ VI: ${vietnameseText}`);

      // 2. Dich: Text VI → Text EN (GPT)
      const englishText =
        await this.translationService.translate(vietnameseText);
      if (!englishText) return;

      console.log(`🌐 EN: ${englishText}`);

      // 3. TTS: Text EN → Audio (ElevenLabs hoac OpenAI TTS)
      const audioBuffer = await this.translationService.textToSpeech(
        englishText,
        info.voiceId, // Voice ID cua user (neu da clone)
      );

      // 4. Gui audio tieng Anh ve Extension
      if (audioBuffer && client.readyState === 1) {
        // 1 = OPEN
        client.send(audioBuffer);
      }

      // 5. Cap nhat stats
      await this.usersService.updateUsageStats(info.userId, 1);
    } catch (err) {
      console.error('Translation error:', err.message);
    }
  }
}
