import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // 🔥 내 현재 상태 조회
  @UseGuards(JwtGuard)
  @Get('me/status')
  async getMyStatus(@Req() req) {
    const { googleSub } = req.user;

    const session = await this.queueService.getSessionInfo(googleSub);

    return {
      status: session?.status ?? 'NONE',
    };
  }
}
