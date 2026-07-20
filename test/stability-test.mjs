import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/state.js';
import { advanceBattle } from '../src/game-loop.js';
import { cellXY } from '../src/ui-layout.js';

function deployStressArmy(state) {
  const starterCells = [[4, 4], [4, 5], [5, 4]];
  starterCells.forEach(([r, c], index) => {
    state.grid[r][c].unit = state.bench[index];
    state.bench[index] = null;
  });
  const heroCells = [[1, 1], [2, 4], [4, 1], [6, 4], [8, 1]];
  state.heroes = Object.keys(CONFIG.heroes).map((key, index) => ({
    key, r: heroCells[index][0], c: heroCells[index][1], cd: 0, ultCd: 0,
  }));
}

let simulated = 0;
let battles = 0;
let peakEffects = 0;
let peakEnemies = 0;
let peakProjectiles = 0;

while (simulated < 1_800) {
  const state = createGame(4, 5);
  state.title = false;
  state.phaseT = 0;
  deployStressArmy(state);
  let elapsed = 0;
  while (!state.over && elapsed < 300) {
    advanceBattle(state, 0.025, cellXY);
    if (state.phase === 'break' && state.phaseT !== null) state.phaseT = 0;
    elapsed += 0.025;
    peakEffects = Math.max(peakEffects, state.effects.length);
    peakEnemies = Math.max(peakEnemies, state.enemies.length);
    peakProjectiles = Math.max(peakProjectiles, state.projectiles.length);
    assert.ok(state.lives >= 0, '高压战斗中生命不能为负数');
  }
  assert.equal(state.over, true, '压力局必须在时限内结算');
  assert.equal(state.win, true, '完整兵种与五英雄压力局应能完成第五关');
  assert.equal(state.enemies.length, 0, '结算时不可残留敌人');
  assert.ok(state.effects.length <= 24, `单局结算效果不可失控：${state.effects.length}`);
  assert.ok(state.projectiles.length <= 6, `单局结算弹道不可失控：${state.projectiles.length}`);
  simulated += elapsed;
  battles++;
}

assert.ok(peakEnemies >= 4, '压力测试必须实际生成敌群');
assert.ok(peakProjectiles >= 1, '压力测试必须实际生成弓箭弹道');
assert.ok(peakEffects >= 3, '压力测试必须实际触发英雄与命中特效');
assert.ok(peakEffects <= 64, `五英雄同屏爆发效果不可失控：峰值 ${peakEffects}`);

console.log(`✓ ${Math.floor(simulated)} 秒真实战斗压力：${battles} 局，敌${peakEnemies}/弹道${peakProjectiles}/效果${peakEffects}峰值`);
