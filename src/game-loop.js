import { updateWaves, updateEnemies } from './enemies.js';
import { updateUnits, updateProjectiles } from './units.js';
import { advanceSkillEntities, updateHeroes, updateDragonDamage } from './heroes.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import {
  advanceSimulationTime,
  gamePackFor,
  registryFor,
  runtimeFor,
} from './engine-core/public.js';
import { publishSystemPresentationCue } from './rulesets/merge-defense/domain-event-runtime.js';
import { ITEM_REGISTRY } from './systems/equipment-items/index.js';
import {
  PRESENTATION_CUE_TYPES,
  updateEffects,
} from './systems/skin-presentation/index.js';

// 固定路线模式的调用顺序属于集成契约；改变它会改变同 seed 对局结果，必须单独评审。
export const FIXED_ROUTE_UPDATE_ORDER = Object.freeze([
  'foundation-runtime.advance-simulation-time',
  'equipment-items.update-generator',
  'stage-encounter.update-waves',
  'combat.update-enemies',
  'integration-quality.update-units',
  'skill-status.update-heroes',
  'skill-status.update-dragon-damage',
  'combat.update-projectiles',
  'skill-status.advance-skill-entities',
  'skin-presentation.update-effects',
]);

export function advanceBattle(state, dt, cellXY, gamePack = gamePackFor(state, DEFAULT_GAME_PACK)) {
  if (state.over || dt <= 0) return;

  advanceSimulationTime(state, dt);
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
