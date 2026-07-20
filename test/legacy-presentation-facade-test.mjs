import assert from 'node:assert/strict';
import { createGame } from '../src/state.js';
import { render } from '../src/render.js';
import { drawTitle } from '../src/render-title.js';
import { drawEnemies } from '../src/render-enemies.js';
import { drawBattleSignals, drawTopBar } from '../src/render-battle-hud.js';
import { drawBattleControls } from '../src/render-battle-controls.js';
import {
  assetsFor,
  drawBattleBackdrop,
  drawButton,
  drawPaper,
  drawStars,
  drawToolAtlasIcon,
  getAssetStatus,
  presentationTokens,
  themeColors,
} from '../src/render-theme.js';

function createCanvasContextStub() {
  const gradient = { addColorStop() {} };
  return new Proxy({ canvas: { width: 420, height: 760 } }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

const context = createCanvasContextStub();
const state = createGame();
const drag = { item: null, mode: null };

assert.doesNotThrow(() => render(context, state, drag), '根 render 兼容签名可省略 Game Pack');
assert.doesNotThrow(() => drawTitle(context, state), '标题渲染兼容签名可省略 Game Pack');
state.enemyViews = [];
assert.doesNotThrow(() => drawEnemies(context, state));
assert.doesNotThrow(() => drawTopBar(context, state));
assert.doesNotThrow(() => drawBattleSignals(context, state));
assert.doesNotThrow(() => drawBattleControls(context, state, drag, () => {}));

state.title = false;
state.effects.push({
  kind: 'text', effectId: 'effect.text', text: '+1',
  x: 210, y: 300, t: 0.05, life: 0.8, scale: 1, color: '#9f2f25',
});
assert.doesNotThrow(() => render(context, state, drag),
  '浮字 renderer 必须收到当前 Game Pack，不能依赖未定义的闭包变量');

assert.doesNotThrow(() => themeColors());
assert.doesNotThrow(() => presentationTokens());
assert.doesNotThrow(() => assetsFor());
assert.doesNotThrow(() => getAssetStatus());
assert.doesNotThrow(() => drawPaper(context));
assert.doesNotThrow(() => drawBattleBackdrop(context));
assert.doesNotThrow(() => drawButton(context, { x: 0, y: 0, w: 100, h: 40 }, '开始', '第一关'));
assert.doesNotThrow(() => drawStars(context, 0, 20));
assert.equal(drawToolAtlasIcon(context, 'item.shovel', 0, 0, 20), false);

console.log('✓ 根层 Presentation 兼容门面保留可省略 Game Pack 的旧签名');
