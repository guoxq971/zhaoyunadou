export const STAGE_ENCOUNTER_API_VERSION = '1.0.0';

export { createEnemySpawnDefinition, pickEnemyType } from './rules.js';
export {
  consumeStageEncounterDomainEvents,
  createStageEncounterStateSlice,
  nextEncounterEnemyId,
  createStageEncounterCommandHandlers,
  requestWaveStart,
  updateStageEncounter,
} from './stage-encounter.js';
