export const COMBAT_API_VERSION = '1.0.0';

export function acceptEnemySpawn(state, definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('[combat] enemy definition is required');
  if (typeof definition.enemyId !== 'string') throw new TypeError('[combat] enemy identity is required');
  if (state.enemies.some(({ enemyId }) => enemyId === definition.enemyId)) {
    throw new Error(`[combat] duplicate enemy identity "${definition.enemyId}"`);
  }
  const enemy = { ...definition };
  state.enemies.push(enemy);
  return enemy;
}

export { damageEnemy } from './damage.js';
export { enemyGameplayXY, updateEnemies } from './enemy-movement.js';
export { findTarget, updateProjectiles, updateUnits } from './unit-attacks.js';
export { snapshotCombatRuntimeState } from './combat-state.js';
export {
  attackResolvedEvent,
  enemyDefeatedEvent,
  enemyIdOf,
  enemyLeakedEvent,
} from './domain-events.js';
