// 巨鹿地图：上下两条互不相交、彼此旋转对称的 S 型行军线。
// 类型：path=行军路 open=可放置 locked=待铲 gate=两路营门。
import { CONFIG } from './config.js';

const LANE_0 = [
  { r: 0, c: 7 },
  { r: 1, c: 7 }, { r: 1, c: 6 }, { r: 1, c: 5 }, { r: 1, c: 4 },
  { r: 2, c: 4 }, { r: 2, c: 5 }, { r: 2, c: 6 }, { r: 2, c: 7 },
  { r: 3, c: 7 }, { r: 3, c: 6 }, { r: 3, c: 5 }, { r: 3, c: 4 },
  { r: 3, c: 3 }, { r: 3, c: 2 }, { r: 3, c: 1 }, { r: 3, c: 0 },
  { r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 },
  { r: 1, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 0 },
  { r: 0, c: 0 },
];

const rotate180 = ({ r, c }, rows, cols) => ({ r: rows - 1 - r, c: cols - 1 - c });

const asCell = (value) => Array.isArray(value) ? { r: value[0], c: value[1] } : { r: value.r, c: value.c };

function mapDefinition(gamePack, mapId) {
  const maps = gamePack?.manifests?.levels?.maps;
  if (Array.isArray(maps)) return maps.find((map) => map.id === mapId) ?? maps[0];
  if (maps && typeof maps === 'object') return maps[mapId] ?? Object.values(maps)[0];
  return null;
}

export function buildMap(gamePack, mapId) {
  const config = gamePack?.config ?? CONFIG;
  const { cols, rows } = config.board;
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ type: 'locked', unit: null })),
  );

  const definition = mapDefinition(gamePack, mapId);
  const declaredLanes = definition?.lanes;
  let paths = Array.isArray(declaredLanes) && declaredLanes.length > 0
    ? declaredLanes.map((lane) => (
      Array.isArray(lane) ? lane.map(asCell) : lane.cells.map(asCell)
    ))
    : [LANE_0.map(asCell)];
  // 仅声明一路且选择旋转对称时，ruleset 自动派生第二路；显式多路则全部保留。
  if (paths.length === 1 && (definition?.symmetry ?? 'rotate-180') === 'rotate-180') {
    paths = [...paths, paths[0].map((cell) => rotate180(cell, rows, cols))];
  }
  paths.forEach((path, lane) => {
    path.forEach(({ r, c }) => {
      grid[r][c].type = 'path';
      grid[r][c].lane = lane;
    });
  });

  // 敌军从墨色荆棘进入；两路终点都是营门，共同保护唯一的阿斗命数。
  for (const [lane, path] of paths.entries()) {
    const start = path[0];
    const end = path[path.length - 1];
    grid[start.r][start.c].decoration = 'bramble';
    grid[end.r][end.c].type = 'gate';
    grid[end.r][end.c].lane = lane;
  }

  // 初始开放区集中在两路之间，保留多组横向双格以便合成英雄。
  const OPEN = definition?.openCells ?? [
    [0, 2], [0, 3], [0, 4],
    [4, 2], [4, 3], [4, 4], [4, 5],
    [5, 2], [5, 3], [5, 4], [5, 5],
    [9, 3], [9, 4], [9, 5],
  ];
  for (const value of OPEN) {
    const { r, c } = asCell(value);
    grid[r][c].type = 'open';
  }

  // path 保留为第一路别名，兼容仍按单路读取的旧调用点。
  const legacyLane = Math.min(definition?.legacyPathLane ?? 0, paths.length - 1);
  return { grid, paths, path: paths[Math.max(0, legacyLane)] };
}
