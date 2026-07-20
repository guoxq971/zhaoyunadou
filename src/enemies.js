// 兼容门面：Encounter 拥有波次，Combat 拥有移动/伤害；本文件仅保留旧 API 和表现适配。
import { CONFIG } from './config.js';
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
  drainSystemPresentationCues,
  publishSystemDomainEvent,
  publishSystemPresentationCue,
  pumpSystemDomainEvents,
} from './rulesets/merge-defense/domain-event-runtime.js';
import {
  consumePresentationCues,
  PRESENTATION_CUE_TYPES,
} from './systems/skin-presentation/index.js';

const configFor = (state) => gamePackFor(state)?.config ?? CONFIG;
const packFor = (state) => gamePackFor(state) ?? { config: CONFIG };
const tickFor = (state) => runtimeFor(state)?.currentTick?.() ?? 0;

function flushPresentation(state, gamePack) {
  return consumePresentationCues(
    state,
    drainSystemPresentationCues(state, gamePack),
    gamePack,
  );
}

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
    publishSystemPresentationCue(state, {
      type: PRESENTATION_CUE_TYPES.waveCompleted,
      source: 'integration-quality',
      tick: tickFor(state),
      payload: { wave: state.wave, reward: result.reward },
    }, gamePack);
  }
  flushPresentation(state, gamePack);
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
    publishSystemPresentationCue(state, {
      type: PRESENTATION_CUE_TYPES.enemyLeaked,
      source: 'integration-quality',
      tick: event.tick,
      payload: { ...event.payload, ...point },
    }, gamePack);
  }
  pumpSystemDomainEvents(state, gamePack);
  flushPresentation(state, gamePack);
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
  const publish = (definition) => {
    const event = publishSystemDomainEvent(state, definition, gamePack);
    const type = event.type === 'combat.attack_resolved'
      ? PRESENTATION_CUE_TYPES.combatAttack
      : event.type === 'combat.enemy_defeated'
        ? PRESENTATION_CUE_TYPES.enemyDefeated
        : null;
    if (type) publishSystemPresentationCue(state, {
      type,
      source: 'integration-quality',
      tick: event.tick,
      payload: { ...event.payload, ...position },
    }, gamePack);
    return event;
  };
  const result = resolveDamage(state, enemy, damage, {
    tick: tickFor(state),
    attackerId: metadata.attackerId ?? metadata.source ?? null,
    attackKind: metadata.attackKind ?? 'direct',
    publish,
  });
  if (!result.ok) return result;
  pumpSystemDomainEvents(state, gamePack);
  flushPresentation(state, gamePack);
  return result;
}
