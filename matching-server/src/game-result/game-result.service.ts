import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GameResultDto } from './dto/game-result.dto';

@Injectable()
export class GameResultService {
  private readonly logger = new Logger(GameResultService.name);

  constructor(private readonly dataSource: DataSource) {}

  async save(dto: GameResultDto) {
    // (선택) 중복 방지: 같은 gameId가 이미 저장됐으면 무시
    const exists = await this.dataSource.query(
      `SELECT game_id FROM games WHERE game_id = ? LIMIT 1`,
      [dto.gameId],
    );
    if (exists.length > 0) {
      this.logger.warn(`Duplicate gameId ignored: ${dto.gameId}`);
      return;
    }

    // (선택) 봇 필터링: googleSub가 BOT_로 시작하면 제외
    const filtered = dto.results.filter((r) => !r.googleSub.startsWith('BOT_'));
    if (filtered.length === 0) {
      throw new BadRequestException('No human results to save');
    }

    await this.dataSource.transaction(async (manager) => {
      // 1) games 저장
      await manager.query(
        `INSERT INTO games (game_id, room_id, ended_at) VALUES (?, ?, ?)`,
        [dto.gameId, dto.roomId, new Date()],
      );

      // 2) game_results 저장 (N rows)
      for (const r of filtered) {
        await manager.query(
          `INSERT INTO game_results (game_id, google_sub, score, \`rank\`) VALUES (?, ?, ?, ?)`,
          [dto.gameId, r.googleSub, r.score, r.rank],
        );
      }
    });

    this.logger.log(
      `Saved game-result: gameId=${dto.gameId}, rows=${filtered.length}`,
    );
  }
}
