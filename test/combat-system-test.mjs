import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame } from '../src/state.js';
import { ensurePieceIdentity } from '../src/systems/piece/index.js';
import {
  COMBAT_API_VERSION,
  damageEnemy,
  enemyGameplayXY,
  findTarget,
  snapshotCombatRuntimeState,
  updateEnemies,
  updateProjectiles,
  updateUnits,
} from '../src/systems/combat/index.js';
import { cellXY } from '../src/ui-layout.js';
import { CONFIG } from '../src/config.js';

const events = [];
const publish = (event) => events.push(event);

assert.equal(COMBAT_API_VERSION, '1.0.0');

{
  const source = await readFile(new URL('../src/systems/combat/index.js', import.meta.url), 'utf8');
  for (const forbidden of [
    "from '../../enemies.js'",
    "from '../../effects.js'",
    "from '../stage-encounter/",
    "from '../skin-presentation/",
    'state.mantou',
    'state.effects',
  ]) {
    assert.equal(source.includes(forbidden), false, `Combat 不得包含 ${forbidden}`);
  }
}

{
  const state = createGame();
  const unidentified = {
    type: 'normal', wave: 1, lane: 0,
    hp: 10, maxHp: 10, p: 0, speed: 0, stun: 0,
  };
  state.enemies.push(unidentified);
  assert.throws(() => damageEnemy(state, unidentified, 1), /enemy\.enemyId/,
    'enemyId 必须由 Encounter 稳定注入，Combat 不得自建隐式计数器');
  state.enemies.length = 0;
  const enemy = {
    enemyId: 'enemy-1', type: 'normal', wave: 1, lane: 0,
    hp: 10, maxHp: 10, p: 0, speed: 0, stun: 0,
  };
  state.enemies.push(enemy);
  const before = { mantou: state.mantou, effects: state.effects.length };
  const first = damageEnemy(state, enemy, 3, {
    tick: 4, attackerId: 'piece-1', attackKind: 'direct', publish,
  });
  assert.deepEqual(first, {
    ok: true, damage: 3, hpBefore: 10, hpRemaining: 7, defeated: false,
  });
  assert.equal(events.at(-1).type, 'combat.attack_resolved');
  const second = damageEnemy(state, enemy, 7, {
    tick: 5, attackerId: 'piece-1', attackKind: 'direct', publish,
  });
  assert.equal(second.defeated, true);
  assert.equal(state.enemies.includes(enemy), false);
  assert.equal(state.stats.kills, 1);
  assert.deepEqual({ mantou: state.mantou, effects: state.effects.length }, before,
    '战斗只发布击杀事实，不得发奖或写表现粒子');
  assert.deepEqual(events.slice(-2).map(({ type }) => type), [
    'combat.attack_resolved', 'combat.enemy_defeated',
  ]);
  assert.equal(events.at(-1).payload.enemyId, 'enemy-1');
}

{
  events.length = 0;
  const state = createGame();
  const enemy = {
    enemyId: 'enemy-2', type: 'fast', wave: 2, lane: 1,
    hp: 20, maxHp: 20, p: state.paths[1].length - 1 - 0.01,
    speed: 2, stun: 0,
  };
  state.enemies = [enemy];
  const lives = state.lives;
  const result = updateEnemies(state, 0.1, cellXY, { tick: 8, publish });
  assert.equal(result.leaked.length, 1);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.lives, lives, '漏怪扣命由 Encounter 消费 DomainEvent，Combat 不写其状态');
  assert.equal(events[0].type, 'combat.enemy_leaked');
  assert.equal(events[0].payload.enemyId, 'enemy-2');

  const stunned = {
    enemyId: 'enemy-3', type: 'normal', wave: 2, lane: 0,
    hp: 20, maxHp: 20, p: 1, speed: 2, stun: 0.4,
  };
  state.enemies = [stunned];
  updateEnemies(state, 0.1, cellXY, { tick: 9, publish });
  assert.equal(stunned.p, 1);
  assert.equal(stunned.stun, 0.4, '状态持续时间由 Skill/Status 拥有，Combat 只读取');
}

{
  const state = createGame();
  const first = {
    enemyId: 'enemy-4', type: 'normal', wave: 1, lane: 0,
    hp: 20, maxHp: 20, p: 0.2, speed: 0, stun: 0,
  };
  const advanced = { ...first, enemyId: 'enemy-5', p: 0.8 };
  state.enemies = [first, advanced];
  const point = enemyGameplayXY(state, first, cellXY);
  assert.equal(findTarget(state, point.x, point.y, 2, cellXY, {
    cellSize: CONFIG.board.cell,
  })?.enemy, advanced, '射程内优先选择路径进度最深的敌军');
}

{
  events.length = 0;
  const state = createGame();
  const location = { r: 1, c: 1 };
  const unit = ensurePieceIdentity(state, {
    kind: 'troop', type: 'gong', level: 1,
  }, { zone: 'grid', ...location });
  state.grid[location.r][location.c].type = 'open';
  state.grid[location.r][location.c].unit = unit;
  const origin = cellXY(location.r, location.c);
  const enemy = {
    enemyId: 'enemy-6', type: 'normal', wave: 1, lane: 0,
    hp: 100, maxHp: 100, p: 4, speed: 0, stun: 0,
  };
  state.enemies = [enemy];
  // 使目标与弓兵重合，只验证攻击管线，不依赖具体关卡射程。
  enemy.p = state.paths[0].findIndex(({ r, c }) => r === location.r && c === location.c);
  if (enemy.p < 0) {
    const routePoint = enemyGameplayXY(state, enemy, cellXY);
    assert.ok(Number.isFinite(routePoint.x));
    // 手写配置扩大射程，不改生产 Game Pack。
  }
  const combatConfig = {
    ...CONFIG,
    troops: { ...CONFIG.troops, gong: { ...CONFIG.troops.gong, range: 99 } },
  };
  const unitBefore = { ...unit };
  const fired = updateUnits(state, 0.1, cellXY, {
    config: combatConfig, tick: 12, publish,
  });
  assert.equal(fired.attacks, 1);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].projectileId, 'projectile-1');
  updateUnits(state, 0.1, cellXY, {
    config: combatConfig, tick: 12, publish,
  });
  assert.equal(state.projectiles.length, 1, '冷却计时属于 Combat 切片且不会重复开火');
  assert.deepEqual({ kind: unit.kind, type: unit.type, level: unit.level }, {
    kind: unitBefore.kind, type: unitBefore.type, level: unitBefore.level,
  });
  assert.equal(Object.hasOwn(unit, 'cd'), false, '攻击冷却不得回写 Piece 状态切片');
  assert.equal(Object.hasOwn(unit, 'flash'), false, '表现反馈应由 DomainEvent/Presentation 消费');
  assert.deepEqual(snapshotCombatRuntimeState(state), {
    attackCooldowns: { [unit.pieceId]: Number((combatConfig.troops.gong.cd - 0.1).toFixed(6)) },
    nextProjectileSequence: 1,
  }, '命令状态哈希/回放可通过公开快照纳入 Combat 内部时钟');

  updateProjectiles(state, 10, cellXY, { tick: 13, publish });
  assert.equal(state.projectiles.length, 0);
  assert.ok(enemy.hp < enemy.maxHp);
  assert.equal(events.some(({ type }) => type === 'combat.attack_resolved'), true);
}

console.log('✓ Combat 索敌、移动、Damage、投射物、领域事件与状态所有权');
