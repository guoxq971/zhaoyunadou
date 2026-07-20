import { assertStableId } from '../../engine-core/public.js';

const tickOf = (tick) => Number.isInteger(tick) && tick >= 0 ? tick : 0;

export function enemyIdOf(enemy) {
  return assertStableId(enemy?.enemyId, 'enemy.enemyId');
}

export function attackResolvedEvent(enemy, {
  tick = 0,
  attackerId = null,
  attackKind = 'direct',
  damage,
  hpBefore,
  hpRemaining,
} = {}) {
  if (attackerId !== null) assertStableId(attackerId, 'attackerId');
  assertStableId(attackKind, 'attackKind');
  return {
    type: 'combat.attack_resolved',
    source: 'combat',
    tick: tickOf(tick),
    payload: {
      enemyId: enemyIdOf(enemy),
      attackerId,
      attackKind,
      damage,
      hpBefore,
      hpRemaining,
    },
  };
}

export function enemyDefeatedEvent(enemy, { tick = 0, attackerId = null } = {}) {
  if (attackerId !== null) assertStableId(attackerId, 'attackerId');
  return {
    type: 'combat.enemy_defeated',
    source: 'combat',
    tick: tickOf(tick),
    payload: {
      enemyId: enemyIdOf(enemy),
      enemyType: enemy.type,
      wave: enemy.wave,
      lane: enemy.lane ?? 0,
      attackerId,
    },
  };
}

export function enemyLeakedEvent(enemy, { tick = 0 } = {}) {
  return {
    type: 'combat.enemy_leaked',
    source: 'combat',
    tick: tickOf(tick),
    payload: {
      enemyId: enemyIdOf(enemy),
      enemyType: enemy.type,
      wave: enemy.wave,
      lane: enemy.lane ?? 0,
    },
  };
}

export function publishDefinition(publish, definition) {
  if (typeof publish === 'function') publish(definition);
  return definition;
}
