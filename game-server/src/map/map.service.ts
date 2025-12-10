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
        rowArr.push(0);
        if (ch === 'G') ghostSpawns.push({ x: col, y: row });
        else dots.push({ x: col, y: row, eaten: false });
      }
    }
    map.push(rowArr);
  }

  return { map, dots, ghostSpawns };
}
