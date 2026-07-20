import { troopDamage } from '../attribute/index.js';
import { enemyGameplayXY } from './enemy-movement.js';
import { activeEnemyById, damageEnemy } from './damage.js';
import { attackClockId, combatStateFor, nextProjectileId } from './combat-state.js';

export function findTarget(state, cx, cy, rangeCells, cellXY, { cellSize } = {}) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError('[combat] cellSize must be positive');
  }
  const rangePx = rangeCells * cellSize;
  let best = null;
  let bestProgress = -1;
  for (const enemy of state.enemies) {
    const position = enemyGameplayXY(state, enemy, cellXY);
    const distance = Math.hypot(position.x - cx, position.y - cy);
    if (distance <= rangePx && enemy.p > bestProgress) {
      bestProgress = enemy.p;
      best = { enemy, e: enemy, ...position };
    }
  }
  return best;
}

export function updateUnits(state, dt, cellXY, {
  config,
  tick = 0,
  publish = null,
  modifiers = [],
} = {}) {
  if (!config?.troops || !config?.board) throw new TypeError('[combat] config is required');
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('[combat] dt must be non-negative');
  const combat = combatStateFor(state);
  let attacks = 0;

  for (let row = 0; row < state.grid.length; row++) {
    for (let column = 0; column < state.grid[row].length; column++) {
      const unit = state.grid[row][column].unit;
      if (!unit || unit.kind !== 'troop') continue;
      const rules = config.troops[unit.type];
      if (!rules || rules.behaviorId === 'unit.producer') continue;

      const clockId = attackClockId(unit, row, column);
      const inheritedCooldown = Number.isFinite(unit.cd) ? unit.cd : 0;
      const cooldown = (combat.attackCooldowns[clockId] ?? inheritedCooldown) - dt;
      combat.attackCooldowns[clockId] = cooldown;
      if (cooldown > 0) continue;

      const origin = cellXY(row, column);
      const target = findTarget(state, origin.x, origin.y, rules.range, cellXY, {
        cellSize: config.board.cell,
      });
      if (!target) continue;
      combat.attackCooldowns[clockId] = rules.cd;
      const damage = troopDamage(rules.dmg, unit.level ?? 1, config.levelMult, modifiers, state);
      if (rules.behaviorId === 'unit.projectile' || rules.projectile) {
        state.projectiles.push({
          projectileId: nextProjectileId(state),
          x: origin.x,
          y: origin.y,
          target: target.enemy,
          targetEnemyId: target.enemy.enemyId,
          attackerId: clockId,
          damage,
          dmg: damage,
          speed: rules.projectileSpeed,
        });
      } else {
        damageEnemy(state, target.enemy, damage, {
          tick, attackerId: clockId, attackKind: 'direct', publish,
        });
      }
      attacks++;
    }
  }
  return { attacks };
}

function projectileTarget(state, projectile) {
  if (projectile.target && state.enemies.includes(projectile.target)) return projectile.target;
  return projectile.targetEnemyId ? activeEnemyById(state, projectile.targetEnemyId) : null;
}

export function updateProjectiles(state, dt, cellXY, { tick = 0, publish = null } = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('[combat] dt must be non-negative');
  let resolved = 0;
  const missed = [];
  for (let index = state.projectiles.length - 1; index >= 0; index--) {
    const projectile = state.projectiles[index];
    const target = projectileTarget(state, projectile);
    if (!target) {
      missed.push({
        projectileId: projectile.projectileId ?? null,
        x: projectile.x,
        y: projectile.y,
      });
      state.projectiles.splice(index, 1);
      continue;
    }
    const targetPosition = enemyGameplayXY(state, target, cellXY);
    const distance = Math.hypot(targetPosition.x - projectile.x, targetPosition.y - projectile.y);
    const travel = projectile.speed * dt;
    if (distance <= travel + 8) {
      damageEnemy(state, target, projectile.damage ?? projectile.dmg, {
        tick,
        attackerId: projectile.attackerId ?? null,
        attackKind: 'projectile',
        publish,
      });
      state.projectiles.splice(index, 1);
      resolved++;
      continue;
    }
    projectile.ang = Math.atan2(targetPosition.y - projectile.y, targetPosition.x - projectile.x);
    projectile.x += Math.cos(projectile.ang) * travel;
    projectile.y += Math.sin(projectile.ang) * travel;
  }
  return { resolved, missed };
}
