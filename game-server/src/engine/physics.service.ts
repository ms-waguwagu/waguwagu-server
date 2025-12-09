/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { MAP_DATA, MAP_COLS, MAP_ROWS } from '../map/map.data';

@Injectable()
export class PhysicsService {
  movePlayer(player, dir) {
    const { dx, dy } = dir;

    const nx = player.x + dx;
    const ny = player.y + dy;

    // 맵 범위 체크
    if (nx < 0 || nx >= MAP_COLS || ny < 0 || ny >= MAP_ROWS) return;

    // 벽 체크
    if (MAP_DATA[ny][nx] === 1) return;

    player.x = nx;
    player.y = ny;
  }
}
