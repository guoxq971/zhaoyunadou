import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/state.js';
import { damageEnemy, updateEnemies, updateWaves } from '../src/enemies.js';
import { updateProjectiles, updateUnits } from '../src/units.js';
import { cellXY } from '../src/ui-layout.js';

function spawnedType(stageIndex, wave, total) {
  const state = createGame(stageIndex, stageIndex);
  state.wave = wave;
  state.phase = 'wave';
  state.spawnTotal = total;
  state.spawnLeft = 1;
  state.spawnT = 0;
  updateWaves(state, 0.1);
  return state.enemies[0]?.type;
}

assert.equal(spawnedType(0, 1, 1), 'normal');
assert.equal(spawnedType(0, 4, 4), 'fast');
assert.equal(spawnedType(1, 3, 4), 'fast', '第 2 关应提前引入快兵');
assert.equal(spawnedType(2, 4, 5), 'tank', '第 3 关应在五波战役内引入坦克');
assert.equal(spawnedType(0, 7, 5), 'tank');
assert.equal(spawnedType(0, 10, 8), 'elite');
assert.equal(spawnedType(4, 5, CONFIG.waves.size(5)), 'boss');

{
  const state = createGame();
  const open = state.grid.flatMap((row) => row).find((cell) => cell.type === 'open');
  open.unit = { kind: 'troop', type: 'nong', level: 3, cd: 0 };
  const before = state.mantou;
  updateUnits(state, 0.1, cellXY);
  assert.equal(state.mantou, before + CONFIG.troops.nong.produce * 3);
}

{
  const state = createGame();
  const start = state.path[0];
  state.grid[start.r][start.c].unit = { kind: 'troop', type: 'gong', level: 1, cd: 0 };
  state.enemies.push({ type: 'normal', wave: 1, hp: 100, maxHp: 100, p: 0, speed: 0, stun: 0, bob: 0 });
  updateUnits(state, 0.1, cellXY);
  assert.equal(state.projectiles.length, 1, '弓兵应创建追踪弹道');
}

{
  const state = createGame();
  const target = { type: 'normal', wave: 1, hp: 100, maxHp: 100, p: 0, speed: 0, stun: 0, bob: 0 };
  const targetPos = cellXY(state.path[0].r, state.path[0].c);
  state.enemies.push(target);
  state.projectiles.push({ x: targetPos.x - 30, y: targetPos.y, target, dmg: 10, speed: 380 });
  for (let i = 0; i < 6; i++) updateProjectiles(state, 0.05, cellXY);
  assert.equal(state.projectiles.length, 0, '大步长箭矢跨过目标时也必须命中并销毁');
  assert.equal(target.hp, 90, '跨越命中只结算一次伤害');
}

{
  const state = createGame();
  state.lives = 1;
  const end = state.path.length - 1;
  state.enemies = Array.from({ length: 3 }, () => ({
    type: 'normal', wave: 1, hp: 10, maxHp: 10,
    p: end - 0.01, speed: 10, stun: 0, bob: 0,
  }));
  updateEnemies(state, 0.1, cellXY);
  assert.equal(state.lives, 0, '同帧多敌抵达时生命不能变成负数');
  assert.equal(state.over, true);
}

{
  const state = createGame();
  const enemy = { type: 'normal', wave: 1, hp: 10, maxHp: 10, p: 0, speed: 0, stun: 0, bob: 0 };
  state.enemies.push(enemy);
  damageEnemy(state, enemy, 3, cellXY);
  assert.equal(enemy.hitFlash, 0.12, '受击必须留下短暂闪白反馈');
  damageEnemy(state, enemy, 7, cellXY);
  assert.ok(state.effects.some((effect) => effect.kind === 'text' && effect.text === '破'), '击杀必须生成破敌印记');
}

console.log('✓ 普通/快/坦克/精英/Boss、农民生产与弓箭弹道');
