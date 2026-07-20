// 兼容门面：Encounter 拥有波次，Combat 拥有移动/伤害；本文件仅保留旧 API 和表现适配。
import { CONFIG } from './config.js';
import { gamePackFor, randomFor, runtimeFor } from './engine-core/public.js';
import { routeForEntity } from './systems/board/index.js';
import {
  acceptEnemySpawn,
  assignEnemyIdentity,
  damageEnemy as resolveDamage,
  enemyGameplayXY,
  updateEnemies as moveEnemies,
} from './systems/combat/index.js';
import {
  createEnemySpawnDefinition,
  nextEncounterEnemyId,
  updateStageEncounter,
} from './systems/stage-encounter/index.js';
import {
  drainSystemPresentationCues,
  publishSystemDomainEvent,
  publishSystemPresentationCue,
  pumpSystemDomainEvents,
} from './rulesets/merge-defense/domain-event-runtime.js';
import {
  advanceEnemyPresentationFeedback,
  consumePresentationCues,
  enemyBobPhase,
  PRESENTATION_CUE_TYPES,
  setEnemyBobPhase,
} from './systems/skin-presentation/index.js';
import { consumeStatusTickForState } from './systems/skill-status/index.js';

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
  return assignEnemyIdentity(enemy, nextEncounterEnemyId(state));
}

export function spawnEnemy(state, type, index = state.enemies.length) {
  const definition = createEnemySpawnDefinition({
    gamePack: packFor(state),
    stage: state.stage,
    wave: state.wave,
    type,
    index,
    laneCount: Math.max(1, state.paths?.length ?? 1),
    spawnedAt: state.time,
    enemyId: nextEncounterEnemyId(state),
    allowZeroWave: state.wave === 0,
  });
  const enemy = acceptEnemySpawn(state, definition);
  setEnemyBobPhase(state, enemy.enemyId, randomFor(state, 'presentation')() * 6.28);
  return enemy;
}

export function updateWaves(state, dt) {
  const gamePack = packFor(state);
  const result = updateStageEncounter(state, dt, gamePack, {
    getStage: () => state.stage,
    acceptEnemySpawn(_state, definition) {
      const enemy = acceptEnemySpawn(state, definition);
      setEnemyBobPhase(state, enemy.enemyId, randomFor(state, 'presentation')() * 6.28);
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
  }
  // 保持候选基座时序：眩晕整 tick 同时冻结移动与浮动，其余敌人在同 tick 推进。
  const activeEnemyIds = state.enemies.map(({ enemyId }) => enemyId);
  const blockedEnemyIds = new Set();
  for (const enemy of state.enemies) {
    if (consumeStatusTickForState(
      state,
      enemy.enemyId,
      'stun',
      dt,
      state.time - dt,
    )) blockedEnemyIds.add(enemy.enemyId);
  }
  const movingEnemyIds = activeEnemyIds.filter((enemyId) => !blockedEnemyIds.has(enemyId));
  advanceEnemyPresentationFeedback(state, dt, activeEnemyIds, movingEnemyIds);
  const enemiesById = new Map(state.enemies.map((enemy) => [enemy.enemyId, enemy]));
  const gamePack = packFor(state);
  const result = moveEnemies(state, dt, cellXY, {
    tick: tickFor(state),
    publish: (definition) => publishSystemDomainEvent(state, definition, gamePack),
    isMovementBlocked(_state, enemy) {
      return blockedEnemyIds.has(enemy.enemyId);
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
  return { x: point.x, y: point.y + Math.sin(enemyBobPhase(state, enemy)) * 2 };
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
