import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { AuthGuard } from '@nestjs/passport';

// NestJS에서 API 경로를 'matching'으로 설정합니다.
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  // 닉네임으로 게임 시작 요청 및 매칭 큐 진입
  @Post('queue')
  @UseGuards(AuthGuard('jwt'))
  async enterQueue(@Req() req: Request) {
    const user = (req as any).user as { userId: string; nickname: string };

    // 1. MatchingService를 호출하여
    //    a. Redis Hash에 세션(닉네임, WAITING 상태) 저장
    //    b. Redis List에 UUID를 추가 (대기열 진입)
    const userId = await this.matchingService.enterQueue(
      user.userId,
      user.nickname,
    );

    return {
      message: '매칭 대기열에 성공적으로 진입했습니다.',
      userId,
    };
  }

  @Get('queue-length')
  async getQueueStatus() {
    // 1. Redis에서 총 큐 길이 조회
    const totalLength = await this.matchingService.getQueueLength();

    const MAX_PLAYERS = 5;

    // 2. 현재 매칭 그룹의 인원수 계산
    let currentCount = totalLength % MAX_PLAYERS;

    // 3. 5명으로 꽉 찼을 경우, 모듈러 결과는 0이 되므로 5로 처리 (예: 5/5, 10/5)
    if (currentCount === 0 && totalLength > 0) {
      currentCount = MAX_PLAYERS;
    }

    const message =
      totalLength === 0
        ? '대기 중인 인원이 없습니다.'
        : `현재 매칭 그룹 인원: ${currentCount}/${MAX_PLAYERS}`;

    return {
      message: message,
      currentCount: currentCount,
      totalQueueLength: totalLength,
    };
  }

  @Post('cancel')
  @UseGuards(AuthGuard('jwt'))
  async cancelQueue(@Req() req: Request) {
    const user = (req as any).user as { userId: string; nickname: string };

    await this.matchingService.cancelQueue(user.userId);

    return {
      message: '매칭이 취소되었습니다.',
      currentStatus: 'IDLE',
    };
  }
}
