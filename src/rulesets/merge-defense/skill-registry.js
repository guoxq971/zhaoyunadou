import { createRegistry } from '../../engine-core/registry.js';
import { enemyGameplayXY, enemyXY, damageEnemy } from '../../enemies.js';
import { addSlash, addRing, addDragon, addRain } from '../../effects.js';
import { randomFor } from '../../engine-core/runtime-context.js';

const handlers = {
  'skill.dragon': ({ state, skill }) => {
    const paths = Array.isArray(state.paths) && state.paths.length > 0 ? state.paths : [state.path];
    paths.forEach((_, lane) => addDragon(state, lane, {
      speed: skill.effectSpeed,
      life: skill.effectLife,
      hitDistance: skill.hitDistance,
    }));
  },
  'skill.rain': ({ state, skill, cellXY }) => {
    addRain(state);
    for (const enemy of [...state.enemies]) damageEnemy(state, enemy, skill.dmg, cellXY);
  },
  'skill.shout': ({ state, skill, cx, cy, cellXY }) => {
    addRing(state, cx, cy, '#5a3a1a', 240);
    for (const enemy of [...state.enemies]) {
      enemy.stun = Math.max(enemy.stun, skill.stun);
      damageEnemy(state, enemy, skill.dmg, cellXY);
    }
  },
  'skill.slash': ({ state, skill, cx, cy, cellXY, board }) => {
    addRing(state, cx, cy, '#1f5c2e', skill.range * board.cell);
    const radius = skill.range * board.cell;
    for (const enemy of [...state.enemies]) {
      const position = enemyGameplayXY(state, enemy, cellXY);
      if (Math.hypot(position.x - cx, position.y - cy) <= radius) {
        const visual = enemyXY(state, enemy, cellXY);
        addSlash(state, visual.x, visual.y, randomFor(state, 'presentation')() * 6.28);
        damageEnemy(state, enemy, skill.dmg, cellXY);
      }
    }
  },
  'skill.aura': ({ state, skill, cx, cy }) => {
    addRing(state, cx, cy, '#b8860b', 200);
    state.buff = { mult: skill.mult, until: state.time + skill.dur };
  },
};

export const SKILL_REGISTRY = createRegistry('skill', handlers);
