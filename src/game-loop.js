import { updateWaves, updateEnemies } from './enemies.js';
import { updateUnits, updateProjectiles } from './units.js';
import { advanceSkillEntities, updateHeroes, updateDragonDamage } from './heroes.js';
import { updateEffects } from './effects.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { gamePackFor, registryFor, runtimeFor } from './engine-core/public.js';
import { ITEM_REGISTRY } from './rulesets/merge-defense/item-registry.js';
import { publishSystemPresentationCue } from './rulesets/merge-defense/domain-event-runtime.js';
import { PRESENTATION_CUE_TYPES } from './systems/skin-presentation/index.js';

export function advanceBattle(state, dt, cellXY, gamePack = gamePackFor(state, DEFAULT_GAME_PACK)) {
  if (state.over || dt <= 0) return;

  state.time += dt;
  const itemRegistry = registryFor(state, 'items', ITEM_REGISTRY);
  const generatorId = gamePack.manifests.balance.items['luoyang-shovel'].behaviorId;
  const generated = itemRegistry.get(generatorId).update(state, dt);
  if (generated?.ok) publishSystemPresentationCue(state, {
    type: PRESENTATION_CUE_TYPES.itemGenerated,
    source: 'integration-quality',
    tick: runtimeFor(state)?.currentTick?.() ?? 0,
    payload: { itemId: 'shovel', slot: generated.slot, generated: generated.generated },
  }, gamePack);
  updateWaves(state, dt);
  if (state.over) return;

  updateEnemies(state, dt, cellXY);
  if (state.over) return;

  updateUnits(state, dt, cellXY);
  updateHeroes(state, dt, cellXY);
  updateDragonDamage(state, cellXY);
  updateProjectiles(state, dt, cellXY);
  advanceSkillEntities(state, dt);
  updateEffects(state, dt);
}
