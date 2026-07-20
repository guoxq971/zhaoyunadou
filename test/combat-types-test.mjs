import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/state.js';
import { damageEnemy, spawnEnemy, updateEnemies, updateWaves } from '../src/enemies.js';
import { updateProjectiles, updateUnits } from '../src/units.js';
import { cellXY } from '../src/ui-layout.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import {
  enemyBobPhase,
  presentationFeedbackSnapshot,
  setEnemyBobPhase,
} from '../src/systems/skin-presentation/index.js';
import { skillStatusStateFor } from '../src/systems/skill-status/index.js';
import { createEnemySpawnDefinition } from '../src/systems/stage-encounter/index.js';

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
  const enemy = {
    enemyId: 'enemy-stun-boundary', type: 'normal', wave: 1, lane: 0,
    hp: 10, maxHp: 10, p: 0, speed: 1, stun: 0, bob: 0,
  };
  state.enemies.push(enemy);
  skillStatusStateFor(state).statuses.push({
    statusId: 'stun', targetId: enemy.enemyId,
    appliedAt: 0, expiresAt: 2.5,
  });
  state.time = 2.5;
  updateEnemies(state, 1 / 30, cellXY);
  assert.equal(enemy.p, 0,
    '眩晕在边界 tick 必须保持候选基座的整 tick 阻挡，下一 tick 才恢复移动');
}

{
  const state = createGame();
  const enemy = {
    enemyId: 'enemy-stunned-bob', type: 'normal', wave: 1, lane: 0,
    hp: 10, maxHp: 10, p: 0, speed: 1, stun: 0,
  };
  state.enemies.push(enemy);
  setEnemyBobPhase(state, enemy.enemyId, 1.25);
  skillStatusStateFor(state).statuses.push({
    statusId: 'stun', targetId: enemy.enemyId,
    appliedAt: 0, expiresAt: 2.5,
  });
  state.time = 1;
  updateEnemies(state, 0.1, cellXY);
  assert.equal(enemyBobPhase(state, enemy), 1.25,
    '候选基座中眩晕会同时冻结移动和 bob，表现切片不得改变该时序');
}

{
  const state = createGame(0, 0, undefined, {
    gamePack: undefined,
    random: { presentation: () => 0.5 },
  });
  state.wave = 1;
  const enemy = spawnEnemy(state, 'normal');
  assert.equal(enemyBobPhase(state, enemy), 3.14,
    '敌人初始浮动位相须保持候选基座 random * 6.28 的表现序列');
}

{
  const state = createGame();
  assert.equal(state.wave, 0);
  const enemy = spawnEnemy(state, 'normal');
  assert.equal(enemy.wave, 0, '根级旧 spawnEnemy 在开波前仍兼容 wave=0');
  assert.ok(enemy.hp > 0);
  assert.throws(() => createEnemySpawnDefinition({
    gamePack: DEFAULT_GAME_PACK,
    stage: state.stage,
    wave: 0,
    type: 'normal',
    index: 0,
    laneCount: 1,
    spawnedAt: 0,
    enemyId: 'enemy-2',
  }), /wave must be a positive integer/,
  'Stage/Encounter 公开规则仍必须拒绝 wave=0');
}

{
  const state = createGame();
  const start = state.path[0];
  state.grid[start.r][start.c].unit = { kind: 'troop', type: 'gong', level: 1, cd: 0 };
  state.enemies.push({ type: 'normal', wave: 1, hp: 100, maxHp: 100, p: 0, speed: 0, stun: 0, bob: 0 });
  updateUnits(state, 0.1, cellXY);
  assert.equal(state.projectiles.length, 1, '弓兵应创建追踪弹道');
  const attackerId = state.projectiles[0].attackerId;
  assert.equal(presentationFeedbackSnapshot(state).pieceHitFlashes[attackerId], 0.05,
    '弓兵在发射当帧必须留下已衰减一个 dt 的候选攻击抖动，不能等命中才反馈');
}

{
  const state = createGame();
  const unit = state.bench.find((piece) => piece?.kind === 'troop' && piece.type === 'dao');
  state.bench[state.bench.indexOf(unit)] = null;
  state.grid[0][4].unit = unit;
  state.enemies.push({
    type: 'normal', wave: 1, hp: 100, maxHp: 100,
    p: 4, speed: 0, stun: 0, bob: 0,
  });
  updateUnits(state, 0.1, cellXY);
  const slash = state.effects.find((effect) => effect.kind === 'slash');
  assert.ok(slash, '近战命中必须保留候选基座刀光');
  assert.equal(slash.ang, Math.PI / 2,
    '刀光必须指向目标，不得在 DomainEvent 转 PresentationCue 时丢失角度');
  assert.equal(presentationFeedbackSnapshot(state).pieceHitFlashes[unit.pieceId], 0.05,
    '近战攻击抖动必须在创建当帧按候选顺序衰减一个 dt');
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
  assert.equal(
    presentationFeedbackSnapshot(state).enemyHitFlashes[enemy.enemyId],
    0.12,
    '受击必须在 Presentation 切片留下短暂闪白反馈',
  );
  damageEnemy(state, enemy, 7, cellXY);
  assert.ok(state.effects.some((effect) => effect.kind === 'text' && effect.text === '破'), '击杀必须生成破敌印记');
}

console.log('✓ 普通/快/坦克/精英/Boss、农民生产与弓箭弹道');
