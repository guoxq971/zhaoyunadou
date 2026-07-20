// 兼容门面：Encounter 拥有波次，Combat 拥有移动/伤害；本文件仅保留旧 API 和表现适配。
import { CONFIG } from './config.js';
import { addInk, addText } from './effects.js';
import { copyText } from './engine-core/copy.js';
import { gamePackFor, getStateSlice, randomFor, runtimeFor } from './engine-core/public.js';
import { routeForEntity } from './systems/board/index.js';
import {
  acceptEnemySpawn,
  damageEnemy as resolveDamage,
  enemyGameplayXY,
  updateEnemies as moveEnemies,
} from './systems/combat/index.js';
import {
  createEnemySpawnDefinition,
  updateStageEncounter,
} from './systems/stage-encounter/index.js';
import {
  publishSystemDomainEvent,
  pumpSystemDomainEvents,
} from './rulesets/merge-defense/domain-event-runtime.js';

const configFor = (state) => gamePackFor(state)?.config ?? CONFIG;
const packFor = (state) => gamePackFor(state) ?? { config: CONFIG };
const tickFor = (state) => runtimeFor(state)?.currentTick?.() ?? 0;

export function ensureEnemyIdentity(state, enemy) {
  if (enemy.enemyId) return enemy.enemyId;
  const encounter = getStateSlice(state, 'encounter');
  encounter.nextEnemySequence = (encounter.nextEnemySequence ?? 0) + 1;
  Object.defineProperty(enemy, 'enemyId', {
    value: `enemy-${encounter.nextEnemySequence}`,
    writable: true,
    configurable: true,
  });
  return enemy.enemyId;
}

export function spawnEnemy(state, type, index = state.enemies.length) {
  const encounter = getStateSlice(state, 'encounter');
  encounter.nextEnemySequence = (encounter.nextEnemySequence ?? 0) + 1;
  const definition = createEnemySpawnDefinition({
    gamePack: packFor(state),
    stage: state.stage,
    wave: state.wave,
    type,
    index,
    laneCount: Math.max(1, state.paths?.length ?? 1),
    spawnedAt: state.time,
    enemyId: `enemy-${encounter.nextEnemySequence}`,
  });
  const enemy = acceptEnemySpawn(state, definition);
  enemy.bob = randomFor(state, 'presentation')() * Math.PI * 2;
  return enemy;
}

export function updateWaves(state, dt) {
  const gamePack = packFor(state);
  const result = updateStageEncounter(state, dt, gamePack, {
    acceptEnemySpawn(_state, definition) {
      const enemy = acceptEnemySpawn(state, definition);
      enemy.bob = randomFor(state, 'presentation')() * Math.PI * 2;
      return enemy;
    },
    getLaneCount: () => Math.max(1, state.paths?.length ?? 1),
    hasActiveEnemies: () => state.enemies.length > 0,
    getElapsedTime: () => state.time,
    publishDomainEvent: (_state, definition) => publishSystemDomainEvent(state, definition, gamePack),
  }, tickFor(state));
  pumpSystemDomainEvents(state, gamePack);
  if (['wave-completed', 'encounter-completed'].includes(result.action)) {
    addText(state, 210, 400, copyText(gamePack, 'battle.wave.cleared', {
      wave: state.wave, reward: result.reward,
    }, `第${state.wave}波克复 +${result.reward}馒头`), '#8a6d3b', 1.6);
  }
  return result;
}

export function updateEnemies(state, dt, cellXY) {
  for (const enemy of state.enemies) {
    ensureEnemyIdentity(state, enemy);
    if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.bob = (enemy.bob ?? 0) + dt * 8;
  }
  const enemiesById = new Map(state.enemies.map((enemy) => [enemy.enemyId, enemy]));
  const gamePack = packFor(state);
  const result = moveEnemies(state, dt, cellXY, {
    tick: tickFor(state),
    publish: (definition) => publishSystemDomainEvent(state, definition, gamePack),
    isMovementBlocked(_state, enemy) {
      if (!(enemy.stun > 0)) return false;
      enemy.stun -= dt;
      return true;
    },
  });
  for (const event of result.leaked) {
    const enemy = enemiesById.get(event.payload.enemyId);
    const route = enemy ? routeForEntity(state, enemy) : [];
    const end = route.at(-1);
    const point = end ? cellXY(end.r, end.c) : { x: 0, y: 0 };
    addInk(state, point.x, point.y, '#a02020');
    addText(state, point.x, point.y - 20, copyText(gamePack, 'battle.enemy.leak', {}, '-1❤'), '#c03030', 1.2);
  }
  pumpSystemDomainEvents(state, gamePack);
  return result;
}

export { enemyGameplayXY };

export function enemyXY(state, enemy, cellXY) {
  const point = enemyGameplayXY(state, enemy, cellXY);
  return { x: point.x, y: point.y + Math.sin(enemy.bob ?? 0) * 2 };
}

export function damageEnemy(state, enemy, damage, cellXY, metadata = {}) {
  ensureEnemyIdentity(state, enemy);
  const gamePack = packFor(state);
  const position = enemyXY(state, enemy, cellXY);
  const result = resolveDamage(state, enemy, damage, {
    tick: tickFor(state),
    attackerId: metadata.attackerId ?? metadata.source ?? null,
    attackKind: metadata.attackKind ?? 'direct',
    publish: (definition) => publishSystemDomainEvent(state, definition, gamePack),
  });
  if (!result.ok) return result;
  enemy.hitFlash = 0.12;
  addText(state, position.x + (randomFor(state, 'presentation')() * 16 - 8), position.y - 18,
    String(Math.round(damage)), '#222', 0.7);
  addInk(state, position.x, position.y, '#1a1a1a');
  if (result.defeated) {
    const color = gamePack?.manifests?.theme?.colors?.cinnabarPrimary ?? '#a02020';
    addText(state, position.x, position.y - 28,
      copyText(gamePack, 'battle.enemy.defeated', {}, '破'), color, 1.35,
      { life: 0.82, feedbackId: 'enemy-defeated' });
  }
  pumpSystemDomainEvents(state, gamePack);
  return result;
}
