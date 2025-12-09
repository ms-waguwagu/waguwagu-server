export const TILE_SIZE = 28;

// 맵 디자인
const MAP_DESIGN = [
  "###############################",
  "#.............................#",
  "#.###.#####.###.###.#####.###.#",
  "#.###.#...#.#.....#.#...#.###.#",
  "#.###.###.#.#######.#.###.###.#",
  "#.............................#",
  "#.#####.#.###########.#.#####.#",
  "#.#.....#.....###.....#.....#.#",
  "#.#.###.#.###.###.###.#.###.#.#",
  "#.#.#.#.#...#.....#...#.#.#.#.#",
  "#.#.#.#.###.#######.###.#.#.#.#",
  "#.#.#.....................#.#.#",
  "#.#.#.###.###GGGGG###.###.#.#.#",
  "#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#",
  "#...#.#.#.#GGG.G.GGG#.#.#.#...#",
  "###.#.#.#.#GGG.G.GGG#.#.#.#.###",
  "#...#.#.#.#GGG.G.GGG#.#.#.#...#",
  "#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#",
  "#.#.#.###.###GGGGG###.###.#.#.#",
  "#.#.#.....................#.#.#",
  "#.#.#.###.###########.###.#.#.#",
  "#.#.#.#.#...#.....#...#.#.#.#.#",
  "#.#.###.#.###.#.#.###.#.###.#.#",
  "#.#.....#.....#.#.....#.....#.#",
  "#.#####.#.###########.#.#####.#",
  "#.............................#",
  "#.###.###.#.#######.#.###.###.#",
  "#.#.#.#...#.#.....#.#...#.#.#.#",
  "#.###.#####.###.###.#####.###.#",
  "###############################",
];

// 문자 맵 파싱
const parseMap = (design) => {
  const mapData = [];
  const spawnPoints = [];
  const ghostPoints = [];

  for (let row = 0; row < design.length; row++) {
    const rowString = design[row];
    const currentRow = [];

    for (let col = 0; col < rowString.length; col++) {
      const char = rowString[col];

      if (char === "#") {
        currentRow.push(1);
      } else {
        currentRow.push(0);

        if (char === "S") spawnPoints.push({ x: col, y: row });
        if (char === "G") ghostPoints.push({ x: col, y: row });
      }
    }

    mapData.push(currentRow);
  }

  return { mapData, spawnPoints, ghostPoints };
};

// 파싱 결과
const parsed = parseMap(MAP_DESIGN);

export const MAP_DATA = parsed.mapData;
export const SPAWN_POINTS = parsed.spawnPoints;
export const GHOST_POINTS = parsed.ghostPoints;

export const MAP_ROWS = MAP_DATA.length;
export const MAP_COLS = MAP_DATA[0].length;

// DOT 생성 함수
export function generateDots(map) {
  const dots = [];

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === 0) {
        dots.push({ x, y, eaten: false });
      }
    }
  }

  return dots;
}
