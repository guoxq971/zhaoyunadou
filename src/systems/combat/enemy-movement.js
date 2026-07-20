import {
  routeEndProgress,
  routePosition,
} from '../board/index.js';
import { enemyLeakedEvent, publishDefinition } from './domain-events.js';

// 规则坐标只由 Board/Route 提供，不叠加 bob 等表现随机。
export function enemyGameplayXY(state, enemy, cellXY) {
  return routePosition(state, enemy, cellXY);
}

export function updateEnemies(state, dt, cellXY, {
  tick = 0,
  publish = null,
  isMovementBlocked = (_state, enemy) => enemy.stun > 0,
} = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('[combat] dt must be non-negative');
  const leaked = [];
  for (let index = state.enemies.length - 1; index >= 0; index--) {
    const enemy = state.enemies[index];
    const endProgress = routeEndProgress(state, enemy);
    if (endProgress < 0 || isMovementBlocked(state, enemy)) continue;
    enemy.p += enemy.speed * dt;
    if (enemy.p < endProgress) continue;
    state.enemies.splice(index, 1);
    const event = enemyLeakedEvent(enemy, { tick });
    leaked.push(publishDefinition(publish, event));
  }
  return { leaked };
}
