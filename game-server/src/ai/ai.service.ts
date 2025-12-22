import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';

interface PlayerState {
  id: string;
  x: number;
  y: number;
  is_alive: boolean;
}

interface GameState {
  room_id: string;
  tick: number;
  map_width: number;
  map_height: number;
  boss_x: number;
  boss_y: number;
  players: PlayerState[];
  remaining_dots: number;
  boss_hp: number;
  boss_phase: number;
}

interface AIAction {
  move_x: number;
  move_y: number;
  use_skill: boolean;
  skill_name: string;
}

interface BossAIServiceClient {
  PredictAction(data: GameState): Observable<AIAction>;
}

@Injectable()
export class AiService implements OnModuleInit {
  private bossAIClient: BossAIServiceClient;

  constructor(@Inject('BOSS_AI_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.bossAIClient =
      this.client.getService<BossAIServiceClient>('BossAIService');
  }

  async getBossAction(gameState: GameState): Promise<AIAction> {
    const obs$ = this.bossAIClient.PredictAction(gameState);
    return firstValueFrom(obs$);
  }
}
