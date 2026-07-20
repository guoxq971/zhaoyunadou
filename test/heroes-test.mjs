import assert from 'node:assert/strict';
import { createGame } from '../src/state.js';
import { updateHeroes } from '../src/heroes.js';
import { cellXY } from '../src/ui-layout.js';

function cast(key) {
  const state = createGame();
  const start = state.path[0];
  state.title = false;
  state.time = 1;
  state.heroes = [{ key, r: start.r, c: Math.min(start.c, 7), cd: 999, ultCd: 0 }];
  state.enemies = [{ type: 'normal', wave: 1, hp: 1_000, maxHp: 1_000, p: 0, speed: 0, stun: 0, bob: 0 }];
  updateHeroes(state, 0.1, cellXY);
  return state;
}

assert.ok(cast('zhaoyun').effects.some((effect) => effect.kind === 'dragon'));
assert.ok(cast('huangzhong').effects.some((effect) => effect.kind === 'rain'));

{
  const state = cast('zhangfei');
  assert.ok(state.enemies[0].stun > 0);
  assert.ok(state.enemies[0].hp < 1_000);
}

assert.ok(cast('guanyu').enemies[0].hp < 1_000);

{
  const state = cast('liubei');
  assert.equal(state.buff.mult, 1.5);
  assert.ok(state.buff.until > state.time);
}

console.log('✓ 赵云、黄忠、张飞、关羽、刘备五种大招');
