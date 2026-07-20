import {
  attackResolvedEvent,
  enemyDefeatedEvent,
  enemyIdOf,
  publishDefinition,
} from './domain-events.js';

export function activeEnemyById(state, enemyId) {
  return state.enemies.find((enemy) => enemy.enemyId === enemyId) ?? null;
}

export function listEnemyViews(state) {
  return Object.freeze(state.enemies.map((enemy) => Object.freeze({
    enemyId: enemyIdOf(enemy),
    type: enemy.type,
    wave: enemy.wave,
    lane: enemy.lane ?? 0,
    progress: enemy.p,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
  })));
}

// Damage 只结算 Combat 切片和发布事实；奖励、声音、墨迹由事件消费者处理。
export function damageEnemy(state, enemy, damage, {
  tick = 0,
  attackerId = null,
  attackKind = 'direct',
  publish = null,
} = {}) {
  enemyIdOf(enemy);
  if (!Number.isFinite(damage) || damage < 0) {
    throw new RangeError('[combat] damage must be a non-negative finite number');
  }
  if (!state.enemies.includes(enemy)) return { ok: false, reason: 'enemy-not-active' };

  const hpBefore = enemy.hp;
  enemy.hp -= damage;
  const hpRemaining = enemy.hp;
  publishDefinition(publish, attackResolvedEvent(enemy, {
    tick, attackerId, attackKind, damage, hpBefore, hpRemaining,
  }));

  const defeated = enemy.hp <= 0;
  if (defeated) {
    const index = state.enemies.indexOf(enemy);
    if (index >= 0) state.enemies.splice(index, 1);
    state.stats.kills++;
    publishDefinition(publish, enemyDefeatedEvent(enemy, { tick, attackerId }));
  }
  return { ok: true, damage, hpBefore, hpRemaining, defeated };
}
