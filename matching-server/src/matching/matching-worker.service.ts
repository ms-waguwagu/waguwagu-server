import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchingWorker {
  private readonly logger = new Logger(MatchingWorker.name);
  private isProcessing = false; // 중복 실행 방지용 플래그

  constructor(private readonly queueService: QueueService) {}

  // 2초마다 실행
  @Interval(2000)
  async handleMatchmaking() {
    // 1. 이전 작업이 아직 안 끝났으면 스킵 (오버랩 방지)
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      // 2. 대기열에서 5명 추출 시도 (Lua Script 호출)
      const participants =
        await this.queueService.extractMatchParticipants(5);

      if (!participants) {
        // 5명이 안 모였으면 무시 (로그 너무 많이 찍히니 생략 가능)
        return;
      }

      this.logger.log(`🎉 매칭 성사! 참여자: ${participants.join(', ')}`);

      // 3. TODO: 여기서부터 '게임 룸 생성' 로직 시작
      // await this.processMatching(participants);
      // (다음 단계에서 구현할 부분)
    } catch (error) {
      this.logger.error('매칭 처리 중 에러 발생', error);
      // 에러 발생 시, 추출된 유저들을 다시 큐에 넣는 롤백 로직 필요
      // await this.matchingService.rollbackQueue(participants);
    } finally {
      // 작업 완료 후 플래그 해제
      this.isProcessing = false;
    }
  }
}
