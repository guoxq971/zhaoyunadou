import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  B,
  UI,
  benchRect,
  boardCell,
  boardHeight,
  boardWidth,
  inRect,
  toolRect,
  titleStageRect,
} from '../src/ui-layout.js';

assert.deepEqual(CONFIG.canvas, { w: 420, h: 760 }, '逻辑画布比例应贴近参考图');
assert.deepEqual(CONFIG.board, {
  cols: 8,
  rows: 10,
  cell: 40,
  cellW: 43,
  cellH: 43,
  ox: 38,
  oy: 96,
});
assert.equal(boardWidth, 344);
assert.equal(boardHeight, 430);
assert.equal(B.ox + boardWidth, 382, '棋盘应左右各留 38px');

assert.deepEqual(boardCell(B.ox, B.oy), { r: 0, c: 0 });
assert.deepEqual(
  boardCell(B.ox + boardWidth - 0.01, B.oy + boardHeight - 0.01),
  { r: 9, c: 7 },
);
assert.equal(boardCell(B.ox - 0.01, B.oy), null);
assert.equal(boardCell(B.ox, B.oy + boardHeight), null);

assert.ok(B.oy + boardHeight <= UI.bench.y - 12, '棋盘与营栏需保留手绘外框间距');
for (const key of ['pause', 'shovel', 'recruit', 'speed', 'start']) {
  assert.ok(UI[key].w >= 44 && UI[key].h >= 44, `${key} 必须满足移动端热区`);
}

const titleStages = Array.from({ length: CONFIG.campaign.stages.length }, (_, index) => titleStageRect(index));
assert.equal(titleStages.length, 5);
assert.ok(titleStages.every((rect) => rect.w >= 44 && rect.h >= 44), '关卡军令章应满足移动端热区');
assert.ok(titleStages.every((rect, index) => index === 0 || rect.x >= titleStages[index - 1].x + titleStages[index - 1].w), '关卡军令章热区不可重叠');
assert.ok(titleStages.at(-1).x + titleStages.at(-1).w <= CONFIG.canvas.w - 40);
assert.ok(UI.resetProgress.w >= 44 && UI.resetProgress.h >= 44);

const lastBench = benchRect(CONFIG.benchSize - 1);
assert.ok(lastBench.x + lastBench.w <= CONFIG.canvas.w - 24, '营栏不得越出右侧纸边');
for (let index = 0; index < CONFIG.benchSize; index++) {
  const rect = benchRect(index);
  assert.equal(inRect(rect.x + rect.w / 2, rect.y + rect.h / 2, rect), true);
}

const tools = Array.from({ length: 5 }, (_, index) => toolRect(index));
assert.equal(tools.length, 5);
assert.ok(tools.every((slot) => slot.y + slot.h <= CONFIG.canvas.h - 20));
assert.ok(tools.every((slot, index) => index === 0 || slot.x >= tools[index - 1].x + tools[index - 1].w));

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
assert.equal(overlaps(UI.pause, UI.callWave), false, '暂停与迎敌热区不可重叠');
assert.equal(overlaps(UI.recruit, UI.shovel), false);
assert.equal(overlaps(UI.recruit, UI.speed), false);

assert.equal(inRect(UI.start.x + UI.start.w / 2, UI.start.y + UI.start.h / 2, UI.start), true);
assert.equal(inRect(UI.start.x - 0.01, UI.start.y, UI.start), false);

console.log('✓ 参考图比例、棋盘长格与共享 UI 热区');
