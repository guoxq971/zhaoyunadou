import { updateWaves, updateEnemies } from './enemies.js';
import { updateUnits, updateProjectiles } from './units.js';
import { updateHeroes, updateDragonDamage } from './heroes.js';
import { updateEffects } from './effects.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { gamePackFor, registryFor } from './engine-core/runtime-context.js';
import { ITEM_REGISTRY } from './rulesets/merge-defense/item-registry.js';

export function advanceBattle(state, dt, cellXY, gamePack = gamePackFor(state, DEFAULT_GAME_PACK)) {
  if (state.over || dt <= 0) return;

  state.time += dt;
  const itemRegistry = registryFor(state, 'items', ITEM_REGISTRY);
  const generatorId = gamePack.manifests.balance.items['luoyang-shovel'].behaviorId;
  itemRegistry.get(generatorId).update(state, dt);
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
