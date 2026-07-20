import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { drawRouteOverlay } from '../src/presentation-pack/route-overlay.js';

function capture(paths) {
  const commands = [];
  const ctx = new Proxy({
    save() {}, restore() {}, beginPath() {}, closePath() {}, stroke() {}, fill() {}, setLineDash() {},
    moveTo(x, y) { commands.push(['move', x, y]); },
    lineTo(x, y) { commands.push(['line', x, y]); },
    translate() {}, rotate(angle) { commands.push(['rotate', angle]); }, arc() {},
    fillText(label) { commands.push(['label', label]); },
  }, {
    set(target, key, value) { target[key] = value; return true; },
  });
  drawRouteOverlay(ctx, { paths }, DEFAULT_GAME_PACK);
  return commands;
}

const horizontal = capture([[{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]]);
const vertical = capture([[{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }]]);
const turning = capture([[{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }]]);
assert.notDeepEqual(horizontal, vertical, '路线绘制必须随关卡 state.paths 改变，不能复制固定坐标');
assert.ok(horizontal.some(([kind, x]) => kind === 'line' && x > 80));
assert.deepEqual(turning.filter(([kind]) => kind === 'label').map(([, label]) => label), ['入', '守']);
assert.ok(turning.some(([kind]) => kind === 'rotate'), '路线必须绘制方向箭头，包括转折处');

console.log('✓ 路线入口、方向与终点表现读取关卡 state.paths');
