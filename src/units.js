// 兼容门面：攻击/弹道交由 Combat，农民产出交由 Economy。
import { CONFIG } from './config.js';
import { gamePackFor, runtimeFor } from './engine-core/public.js';
import {
  enemyGameplayXY,
  findTarget as selectTarget,
  updateProjectiles as resolveProjectiles,
  updateUnits as resolveUnitAttacks,
} from './systems/combat/index.js';
import { updateProducerIncome } from './systems/economy/index.js';
import { ensureEnemyIdentity } from './enemies.js';
import {
  drainSystemPresentationCues,
  publishSystemDomainEvent,
  publishSystemPresentationCue,
  pumpSystemDomainEvents,
} from './rulesets/merge-defense/domain-event-runtime.js';
import {
  consumePresentationCues,
  advancePiecePresentationFeedback,
  PRESENTATION_CUE_TYPES,
} from './systems/skin-presentation/index.js';

const packFor = (state) => gamePackFor(state) ?? { config: CONFIG };
const tickFor = (state) => runtimeFor(state)?.currentTick?.() ?? 0;

export function findTarget(state, cx, cy, rangeCells, cellXY) {
  return selectTarget(state, cx, cy, rangeCells, cellXY, {
    cellSize: packFor(state).config.board.cell,
  });
}

function eventPublisher(state, cellXY, gamePack) {
  const positions = new Map(state.enemies.map((enemy) => {
    ensureEnemyIdentity(state, enemy);
    return [enemy.enemyId, enemyGameplayXY(state, enemy, cellXY)];
  }));
  const attackerOrigins = new Map();
  for (let row = 0; row < state.grid.length; row++) {
    for (let column = 0; column < state.grid[row].length; column++) {
      const unit = state.grid[row][column].unit;
      if (!unit || unit.kind !== 'troop') continue;
      attackerOrigins.set(unit.pieceId ?? `legacy-piece-${row}-${column}`, cellXY(row, column));
    }
  }
  return (definition) => {
    const event = publishSystemDomainEvent(state, definition, gamePack);
    const point = positions.get(event.payload.enemyId) ?? { x: 0, y: 0 };
    const origin = attackerOrigins.get(event.payload.attackerId) ?? point;
    const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
    const type = event.type === 'combat.attack_resolved'
      ? PRESENTATION_CUE_TYPES.combatAttack
      : event.type === 'combat.enemy_defeated'
        ? PRESENTATION_CUE_TYPES.enemyDefeated
        : null;
    if (type) publishSystemPresentationCue(state, {
      type,
      source: 'integration-quality',
      tick: event.tick,
      payload: { ...event.payload, ...point, angle },
    }, gamePack);
    return event;
  };
}

function flushPresentation(state, gamePack) {
  return consumePresentationCues(
    state,
    drainSystemPresentationCues(state, gamePack),
    gamePack,
  );
}

export function updateUnits(state, dt, cellXY) {
  const gamePack = packFor(state);
  for (const enemy of state.enemies) ensureEnemyIdentity(state, enemy);
  for (const gain of updateProducerIncome(state, dt, cellXY, gamePack.config)) {
    publishSystemPresentationCue(state, {
      type: PRESENTATION_CUE_TYPES.producerIncome,
      source: 'integration-quality',
      tick: tickFor(state),
      payload: gain,
    }, gamePack);
  }
  const result = resolveUnitAttacks(state, dt, cellXY, {
    config: gamePack.config,
    tick: tickFor(state),
    publish: eventPublisher(state, cellXY, gamePack),
    modifiers: state.buff && state.time < state.buff.until
      ? [{
        id: 'liubei-aura', stat: 'damage', operation: 'multiply',
        value: state.buff.mult, priority: 20,
      }]
      : [],
  });
  for (const started of result.started ?? []) publishSystemPresentationCue(state, {
    type: PRESENTATION_CUE_TYPES.unitAttackStarted,
    source: 'integration-quality',
    tick: tickFor(state),
    payload: {
      attackerId: started.attackerId,
      duration: Number(Math.max(0, 0.15 - dt).toFixed(6)),
    },
  }, gamePack);
  advancePiecePresentationFeedback(state, dt);
  pumpSystemDomainEvents(state, gamePack);
  flushPresentation(state, gamePack);
  return result;
}

export function updateProjectiles(state, dt, cellXY) {
  const gamePack = packFor(state);
  for (const enemy of state.enemies) ensureEnemyIdentity(state, enemy);
  const result = resolveProjectiles(state, dt, cellXY, {
    tick: tickFor(state),
    publish: eventPublisher(state, cellXY, gamePack),
  });
  for (const missed of result.missed ?? []) publishSystemPresentationCue(state, {
    type: PRESENTATION_CUE_TYPES.projectileMissed,
    source: 'integration-quality',
    tick: tickFor(state),
    payload: missed,
  }, gamePack);
  pumpSystemDomainEvents(state, gamePack);
  flushPresentation(state, gamePack);
  return result;
}
