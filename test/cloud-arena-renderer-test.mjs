import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import {
  drawCloudArenaCell,
  drawCloudArenaDecoration,
  drawCloudArenaFrame,
  drawCloudArenaPlatform,
  traceProjectedCell,
} from '../src/presentation-pack/cloud-arena-board.js';
import { createSemanticLayout } from '../src/systems/ui-interaction/index.js';

const style = DEFAULT_GAME_PACK.manifests.theme.themeCatalog
  .options['theme.cloud-arena-2-5d'].boardStyle;
const layout = createSemanticLayout(DEFAULT_GAME_PACK.config, {
  projection: style.projection,
});
const commands = [];
const gradient = { addColorStop(offset, color) { commands.push(['stop', offset, color]); } };
const ctx = new Proxy({
  save() {}, restore() {}, beginPath() {}, closePath() {}, fill() { commands.push(['fill']); },
  stroke() { commands.push(['stroke']); }, translate() {}, fillText() {},
  moveTo(x, y) { commands.push(['move', x, y]); },
  lineTo(x, y) { commands.push(['line', x, y]); },
  arc(x, y, radius) { commands.push(['arc', x, y, radius]); },
  quadraticCurveTo(cpx, cpy, x, y) { commands.push(['curve', cpx, cpy, x, y]); },
  createLinearGradient() { return gradient; },
}, { set(target, key, value) { target[key] = value; return true; } });
const colors = {
  openCell: '#cce0d3', lockedCell: '#6b7770', pathCell: '#d8bea0',
  paperRaised: '#fffdf5', paperLight: '#faf6ea', cellLine: '#303830',
  inkStructure: '#252b28', cinnabarPrimary: '#ad392f',
};

drawCloudArenaPlatform(ctx, layout, colors, style);
for (const [column, type] of ['open', 'locked', 'path', 'spawn', 'gate', 'rock'].entries()) {
  const cell = { type, decoration: type === 'spawn' ? 'bramble' : null };
  drawCloudArenaCell(ctx, cell, 0, column, layout, colors, style, DEFAULT_GAME_PACK);
  drawCloudArenaDecoration(ctx, cell, 0, column, layout, colors);
}
drawCloudArenaFrame(ctx, layout, colors, style);
traceProjectedCell(ctx, layout, 4, 3, 2);
ctx.stroke();

assert.ok(commands.filter(([kind]) => kind === 'fill').length > 20,
  '云台 Renderer 必须绘制平台、外墙、格面与倒角多层结构');
assert.ok(commands.some(([kind]) => kind === 'stop'), '石板顶面必须有受控渐变层次');
assert.ok(new Set(commands.filter(([kind]) => kind === 'move').map(([, x]) => Math.round(x))).size > 4,
  '投影 Renderer 不得退化成单一轴对齐矩形');
assert.ok(commands.filter(([kind]) => kind === 'arc').length >= 18,
  '每类石板都需要确定性的砂眼、磨损或边缘颗粒，不能只画纯色格面');
assert.ok(commands.filter(([kind]) => kind === 'curve').length >= 8,
  '围墙需要分段石块与磨圆接缝，不能退化为四条粗黑直线');

console.log('✓ 浅透视云台的平台、旧石材质、分段围墙、装饰与投影命中绘制');
