import { Injectable } from '@nestjs/common';
import { Direction } from '../types/direction.type';
import { TILE_SIZE, MAP_DESIGN } from '../map/map.data';
import { parseMap } from '../map/map.service';

import { GhostManagerService } from './ghost/ghost-manager.service';
import { PlayerService } from './player/player.service';
import { BotManagerService } from './bot/bot-manager.service';
import { CollisionService } from './core/collision.service';
import { LifecycleService } from './core/lifecycle.service';
import { GameLoopService } from './core/game-loop.service';

@Injectable()
export class GameEngineService {
  roomId: string;
  roomManager: any;

  intervalRunning = false;
  interval: NodeJS.Timeout | null = null;

  readonly rows: number;
  readonly cols: number;
  readonly tileSize = TILE_SIZE;

	  // ‼️보스 테스트‼️이 방의 보스 상태는 여기서만 관리
  private boss: { x: number; y: number } | null = null;

  constructor(
    private readonly ghostManager: GhostManagerService,
    private readonly playerService: PlayerService,
    private readonly botManager: BotManagerService,
    private readonly collisionService: CollisionService,
    private readonly lifecycle: LifecycleService,
    private readonly gameLoop: GameLoopService,
  ) {
    const { map } = parseMap(MAP_DESIGN);


    this.rows = map.length;
    this.cols = map[0].length;
  }

	initialize() {
  this.lifecycle.initialize(this.roomId);
}

	// ‼️보스 테스트‼️
  setBoss(boss: { x: number; y: number } | null) {
    this.boss = boss;
  }

  get map() {
    return this.lifecycle.getMap(this.roomId);
  }

  get dots() {
    return this.lifecycle.getDots(this.roomId);
  }

	// ‼️보스 테스트‼️ 전용 루프. 랭킹은 빠져있음
  startBossMode() {
    if (this.intervalRunning) {
      console.log(`[BossMode] Room ${this.roomId} 이미 루프 실행 중`);
      return;
    }

    console.log(`[BossMode] Room ${this.roomId} 보스 모드 루프 시작`);
    this.intervalRunning = true;

    this.interval = setInterval(() => {
      // 1) 기존 게임 루프 한 틱 실행
      this.update();


      // 2) 상태를 해당 room 에 브로드캐스트
      if (this.roomManager && this.roomManager.server) {
        this.roomManager.server
          .to(this.roomId)
          .emit('state', this.getState());
      }

			 // 게임 종료 처리 
    	if (this.gameOver) {
      	console.log(`[BossMode] 게임 종료 → 루프 정리 시작`);

      	if (this.interval) {
        	clearInterval(this.interval);
        	this.interval = null;
      	}
      	this.intervalRunning = false;
    	}
    }, 1000 / 30); // 30 FPS
  }


  getPlayer(id: string) {
    return this.playerService.getPlayer(this.roomId, id);
  }

  addPlayer(id: string, nickname: string) {
    this.playerService.addPlayer(this.roomId, id, nickname);
  }

  removePlayer(id: string) {
    this.playerService.removePlayer(this.roomId, id);
  }

  handleInput(id: string, dir: Direction) {
    this.playerService.handleInput(this.roomId, id, dir);
  }

  playerCount() {
    return this.playerService.playerCount(this.roomId);
  }

  addGhost(id: string, opts?: Partial<{ color: string; speed: number }>) {
    this.ghostManager.addGhost(this.roomId, id, opts);
  }

  addBotPlayer(nickname?: string) {
    this.botManager.addBotPlayer(this.roomId, nickname);
  }

  getBotCount() {
    return this.botManager.getBotCount(this.roomId);
  }

  getNextBotNumber() {
    return this.botManager.getNextBotNumber(this.roomId);
  }

  update() {
    this.gameLoop.run(this.roomId);
  }

  get gameOver() {
    return this.lifecycle.isGameOver(this.roomId);
  }

  resetGame() {
    return this.lifecycle.resetGame(this.roomId);
  }

  getAllPlayerScores() {
    return this.playerService.getPlayers(this.roomId).map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
    }));
  }

  getMapData() {
    return {
      map: this.map,
      dots: this.dots,
      rows: this.rows,
      cols: this.cols,
      tileSize: this.tileSize,
    };
  }

	// ‼️보스 테스트‼️
	// ‼️이 방의 boss만 상태에 포함‼️
  getState() {
    return this.gameLoop.getState(this.roomId, this.boss);
  }
  
  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.intervalRunning = false;
      console.log(`Room ${this.roomId} interval stopped`);
    }
  }
}
