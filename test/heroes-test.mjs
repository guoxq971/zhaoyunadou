import assert from 'node:assert/strict';
import { createGame } from '../src/state.js';
import { updateHeroes } from '../src/heroes.js';
import { cellXY } from '../src/ui-layout.js';
import { presentationFeedbackSnapshot } from '../src/systems/skin-presentation/index.js';
import { statusRemainingForState } from '../src/systems/skill-status/index.js';

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
  assert.ok(statusRemainingForState(state, state.enemies[0].enemyId, 'stun', state.time) > 0);
  assert.equal(state.enemies[0].stun, 0, '状态不得镜像回写 Combat 实体');
  assert.ok(state.enemies[0].hp < 1_000);
}

assert.ok(cast('guanyu').enemies[0].hp < 1_000);

{
  const state = createGame();
  const start = state.path[0];
  state.title = false;
  state.time = 1;
  state.heroes = [{ key: 'zhaoyun', r: start.r, c: Math.min(start.c, 7), cd: 0, ultCd: 999 }];
  state.enemies = [{ type: 'normal', wave: 1, hp: 1_000, maxHp: 1_000, p: 0, speed: 0, stun: 0, bob: 0 }];
  updateHeroes(state, 0.1, cellXY);
  assert.equal(presentationFeedbackSnapshot(state).pieceHitFlashes['hero-zhaoyun-basic'], 0.05,
    '英雄平 A 抖动必须在攻击当帧衰减一个 dt');
}

{
  const state = cast('liubei');
  assert.equal(state.buff.mult, 1.5);
  assert.ok(state.buff.until > state.time);
}

console.log('✓ 赵云、黄忠、张飞、关羽、刘备五种大招');
