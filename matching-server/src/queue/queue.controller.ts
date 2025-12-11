import { Controller, Post, UseGuards, Req, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueGateway } from './queue.gateway';
import { AuthGuard } from '@nestjs/passport';
import { PlayerStatus } from '../common/constants';

@Controller('queue')
export class QueueController {
	constructor(
		private readonly queueService: QueueService,
		private readonly queueGateway: QueueGateway,
    private readonly configService: ConfigService,
	) {}

	// 닉네임으로 게임 시작 요청 및 매칭 큐 진입
	@Post('')
	@UseGuards(AuthGuard('jwt'))
	async enterQueue(@Req() req: Request) {
		const user = (req as any).user as { userId: string; nickname: string };

		// 1. MatchingService를 호출하여
		//    a. Redis Hash에 세션(닉네임, WAITING 상태) 저장
		//    b. Redis List에 UUID를 추가 (대기열 진입)
		const userId = await this.queueService.enterQueue(
			user.userId,
			user.nickname,
		);

		// 2. 대기열 상태 변경 알림
		this.queueGateway.broadcastQueueStatus();

		return {
			message: '매칭 대기열에 성공적으로 진입했습니다.',
			userId,
		};
	}

	@Get('length')
	@UseGuards(AuthGuard('jwt'))
	async getQueueStatus() {
		// 1. Redis에서 총 큐 길이 조회
		
		const totalLength = await this.queueService.getQueueLength();
		const MAX_PLAYERS_COUNT = this.configService.get<number>('MATCH_PLAYER_COUNT');
		const matchCount = this.configService.get<number>('MATCH_PLAYER_COUNT') ?? 5;

  let currentCount = totalLength % matchCount;
  if (currentCount === 0 && totalLength > 0) {
    currentCount = matchCount;
  }

		const message =
			totalLength === 0
				? '대기 중인 인원이 없습니다.'
				: `현재 매칭 그룹 인원: ${currentCount}/${MAX_PLAYERS_COUNT}`;

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

		await this.queueService.cancelQueue(user.userId);

		// 2. 대기열 상태 변경 알림
		this.queueGateway.broadcastQueueStatus();

		return {
			message: '매칭이 취소되었습니다.',
			currentStatus: PlayerStatus.IDLE,
		};
	}
}
