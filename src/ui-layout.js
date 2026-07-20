// 逻辑坐标与 UI 热区；输入和渲染共用，避免视觉模块反向承载交互规则。
import { CONFIG } from './config.js';

export const B = CONFIG.board;
export const boardWidth = B.cols * B.cellW;
export const boardHeight = B.rows * B.cellH;

export const UI = {
  pause:   { x: 40,  y: 10,  w: 48,  h: 48 },
  recruit: { x: 142, y: 606, w: 136, h: 62 },
  shovel:  { x: 44,  y: 604, w: 64,  h: 64 },
  speed:   { x: 312, y: 604, w: 64,  h: 64 },
  bench:   { x: 78,  y: 542, w: 48,  h: 48, gap: 4 },
  tools:   { x: 48,  y: 680, w: 58,  h: 52, gap: 6 },
  restart: { x: 130, y: 490, w: 160, h: 56 },
  start:   { x: 110, y: 510, w: 200, h: 68 },
  callWave:{ x: 138, y: 58,  w: 144, h: 34 },
};

export const cellXY = (r, c) => ({
  x: B.ox + (c + 0.5) * B.cellW,
  y: B.oy + (r + 0.5) * B.cellH,
});

export const benchRect = (i) => ({
  x: UI.bench.x + i * (UI.bench.w + UI.bench.gap),
  y: UI.bench.y,
  w: UI.bench.w,
  h: UI.bench.h,
});

export const toolRect = (i) => ({
  x: UI.tools.x + i * (UI.tools.w + UI.tools.gap),
  y: UI.tools.y,
  w: UI.tools.w,
  h: UI.tools.h,
});

export function boardCell(x, y) {
  const c = Math.floor((x - B.ox) / B.cellW);
  const r = Math.floor((y - B.oy) / B.cellH);
  return r >= 0 && r < B.rows && c >= 0 && c < B.cols ? { r, c } : null;
}

export const inRect = (x, y, rect) =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
