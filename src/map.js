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

export function buildMap() {
  const { cols, rows } = CONFIG.board;
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ type: 'locked', unit: null })),
  );

  // 第二路严格由第一路旋转 180° 得到，因此两路等长且转折节奏完全一致。
  const paths = [
    LANE_0.map(({ r, c }) => ({ r, c })),
    LANE_0.map((cell) => rotate180(cell, rows, cols)),
  ];
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
  const OPEN = [
    [0, 2], [0, 3], [0, 4],
    [4, 2], [4, 3], [4, 4], [4, 5],
    [5, 2], [5, 3], [5, 4], [5, 5],
    [9, 3], [9, 4], [9, 5],
  ];
  for (const [r, c] of OPEN) grid[r][c].type = 'open';

  // path 保留为第一路别名，兼容仍按单路读取的旧调用点。
  return { grid, paths, path: paths[0] };
}
