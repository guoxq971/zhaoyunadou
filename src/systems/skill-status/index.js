export const SKILL_STATUS_API_VERSION = '1.0.0';

export {
  createSkillStatusState,
  createSkillStatusRuntimeStateSlice,
  createSkillStatusStateSlice,
  consumeStatusTickForState,
  nextSkillEntityId,
  registerUnlockedHero,
  skillStatusStateFor,
  statusRemainingForState,
  snapshotSkillStatus,
} from './state.js';
export {
  SKILL_COMBAT_PORT_API_VERSION,
  SKILL_COMBAT_PORT_METHODS,
  assertSkillCombatPort,
} from './ports.js';
export {
  SKILL_HANDLER_IDS,
  SKILL_HANDLER_REGISTRY,
  createSkillExecutionRegistry,
} from './registry.js';
export { createSkillStatusSystem } from './system.js';
