export const TILE_SIZE = 28;

// 맵 디자인 (문자열로 시각화)
// # : 벽 (Wall) -> 1
// . : 길 (Path) -> 0
// S : 플레이어 스폰 위치 (Spawn) -> 0 (길로 처리됨)
// G : 유령/적 스폰 위치 (Ghost) -> 0 (길로 처리됨)
// - : 유령 집 입구 (Gate) -> 0 (일단 길로 처리, 나중에 통과 불가 로직 추가 가능)

const MAP_DESIGN = [
  "###############################", // 0
  "#.............................#", // 1
  "#.###.#####.###.###.#####.###.#", // 2
  "#.###.#...#.#.....#.#...#.###.#", // 3
  "#.###.###.#.#######.#.###.###.#", // 4
  "#.............................#", // 5
  "#.#####.#.###########.#.#####.#", // 6
  "#.#.....#.....###.....#.....#.#", // 7
  "#.#.###.#.###.###.###.#.###.#.#", // 8
  "#.#.#.#.#...#.....#...#.#.#.#.#", // 9
  "#.#.#.#.###.#######.###.#.#.#.#", // 10
  "#.#.#.....................#.#.#", // 11
  "#.#.#.###.###GGGGG###.###.#.#.#", // 12
  "#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#", // 13
  "#...#.#.#.#GGG.G.GGG#.#.#.#...#", // 14
  "###.#.#.#.#GGG.G.GGG#.#.#.#.###", // 15
  "#...#.#.#.#GGG.G.GGG#.#.#.#...#", // 16
  "#.#.#.#.#.#GGG.G.GGG#.#.#.#.#.#", // 17
  "#.#.#.###.###GGGGG###.###.#.#.#", // 18
  "#.#.#.....................#.#.#", // 19
  "#.#.#.###.###########.###.#.#.#", // 20
  "#.#.#.#.#...#.....#...#.#.#.#.#", // 21
  "#.#.###.#.###.#.#.###.#.###.#.#", // 22
  "#.#.....#.....#.#.....#.....#.#", // 23
  "#.#####.#.###########.#.#####.#", // 24
  "#.............................#", // 25
  "#.###.###.#.#######.#.###.###.#", // 26
  "#.#.#.#...#.#.....#.#...#.#.#.#", // 27
  "#.###.#####.###.###.#####.###.#", // 28
  "###############################", // 29
];

// 문자열 맵을 0(길)과 1(벽)의 2차원 배열로 변환하는 파서
const parseMap = (design) => {
  const mapData = [];
  const spawnPoints = []; // 플레이어 스폰
  const ghostPoints = []; // 유령 스폰

  for (let row = 0; row < design.length; row++) {
    const currentRow = [];
    const rowString = design[row];

    for (let col = 0; col < rowString.length; col++) {
      const char = rowString[col];

      if (char === "#") {
        currentRow.push(1); // 벽
      } else {
        currentRow.push(0); // 길
        if (char === "S") spawnPoints.push({ x: col, y: row });
        if (char === "G") ghostPoints.push({ x: col, y: row });
      }
    }

    mapData.push(currentRow);
  }

  return { mapData, spawnPoints, ghostPoints };
};

// 파싱 실행
const parsed = parseMap(MAP_DESIGN);

export const MAP_DATA = parsed.mapData;
export const SPAWN_POINTS = parsed.spawnPoints; // 자동 추출된 스폰 포인트들
export const GHOST_POINTS = parsed.ghostPoints;
export const MAP_ROWS = MAP_DATA.length;
export const MAP_COLS = MAP_DATA[0].length;
