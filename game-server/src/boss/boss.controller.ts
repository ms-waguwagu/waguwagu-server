import { Body, Controller, Post } from '@nestjs/common';
import { BossRoomService } from './boss.service';

@Controller('boss')
export class BossController {
  constructor(private readonly bossRoomService: BossRoomService) {}

  @Post('debug-room')
  async createDebugRoom(@Body('nickname') nickname: string) {
    const result = await this.bossRoomService.createDebugRoom({ nickname });
    return result;
  }
}
