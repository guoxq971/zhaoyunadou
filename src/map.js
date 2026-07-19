// 巨鹿地图:格子类型 + 敌人路径
// 类型:path=行军路 open=可放置 locked=待铲 rock=障碍 dou=阿斗
import { CONFIG } from './config.js';

export function buildMap() {
  const { cols, rows } = CONFIG.board;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push(Array.from({ length: cols }, () => ({ type: 'locked', unit: null })));
  }

  // 蛇形路径:上入口 → 蛇形三折 → 右下阿斗
  const path = [];
  const mark = (r, c) => { grid[r][c].type = 'path'; path.push({ r, c }); };
  for (let c = 0; c <= 8; c++) mark(0, c);        // 行0 左→右
  for (let r = 1; r <= 2; r++) mark(r, 8);        // 列8 下行
  for (let c = 8; c >= 0; c--) mark(3, c);        // 行3 右→左
  for (let r = 4; r <= 5; r++) mark(r, 0);        // 列0 下行
  for (let c = 0; c <= 8; c++) mark(6, c);        // 行6 左→右
  for (let r = 7; r <= 8; r++) mark(r, 8);        // 列8 下行
  grid[9][8].type = 'dou';
  path.push({ r: 9, c: 8 });                      // 终点:阿斗

  // 初始开放格(其余可放置区默认 locked,铲子解锁)
  const OPEN = [
    [1, 1], [1, 2], [2, 1], [2, 2], [1, 5], [2, 5],
    [4, 4], [4, 5], [5, 4], [5, 5],
    [7, 3], [7, 4], [8, 3], [8, 4],
  ];
  for (const [r, c] of OPEN) grid[r][c].type = 'open';

  // 岩石(永不可用,纯地形)
  for (const [r, c] of [[1, 0], [9, 0], [4, 8]]) grid[r][c].type = 'rock';

  return { grid, path };
}
