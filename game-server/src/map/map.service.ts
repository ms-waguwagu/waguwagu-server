import { MAP_DESIGN } from './map.data';

export interface Dot {
  x: number;
  y: number;
  eaten: boolean;
}

export interface ParseMapResult {
  map: number[][];
  dots: Dot[];
  ghostSpawns: { x: number; y: number }[];
}

export function parseMap(design: string[] = MAP_DESIGN): ParseMapResult {
  const map: number[][] = [];
  const dots: Dot[] = [];
  const ghostSpawns: { x: number; y: number }[] = [];

  for (let row = 0; row < design.length; row++) {
    const line = design[row];
    const rowArr: number[] = [];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '#') rowArr.push(1);
      else {
        if (ch === 'G') {
          rowArr.push(2); // 2: 유령 집 (플레이어 진입 불가, 유령만 가능)
          ghostSpawns.push({ x: col, y: row });
        } else {
          rowArr.push(0);
          if (ch === '.') {
            dots.push({ x: col, y: row, eaten: false });
          } else if (ch === 'o') {
            dots.push({ x: col, y: row, eaten: false, type: 'power' } as any);
          }
        }
      }
    }
    map.push(rowArr);
  }

  return { map, dots, ghostSpawns };
}
