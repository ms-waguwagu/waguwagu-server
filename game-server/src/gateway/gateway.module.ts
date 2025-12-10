import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RankingModule } from '../ranking/ranking.module';

@Module({
  imports: [RankingModule],
  providers: [GameGateway],
  exports: [GameGateway], // 다른 모듈에서 사용할 경우
})
export class GatewayModule {}
