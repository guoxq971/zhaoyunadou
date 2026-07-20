import { updateWaves, updateEnemies } from './enemies.js';
import { updateUnits, updateProjectiles } from './units.js';
import { updateHeroes, updateDragonDamage } from './heroes.js';
import { updateEffects } from './effects.js';
import { updateLuoyangShovel } from './field-tools.js';

export function advanceBattle(state, dt, cellXY) {
  if (state.over || dt <= 0) return;

  state.time += dt;
  updateLuoyangShovel(state, dt);
  updateWaves(state, dt);
  if (state.over) return;

  updateEnemies(state, dt, cellXY);
  if (state.over) return;

  updateUnits(state, dt, cellXY);
  updateHeroes(state, dt, cellXY);
  updateDragonDamage(state, cellXY);
  updateProjectiles(state, dt, cellXY);
  updateEffects(state, dt);
}
