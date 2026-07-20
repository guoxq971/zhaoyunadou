// 跨系统使用的稳定基础契约入口；内部模块仍可按职责拆分。
export { createAssetLoader } from './assets.js';
export { CONTROLLER_API_VERSION } from './controller.js';
export { copyText } from './copy.js';
export { composeCommandHandlerMaps } from './command-handlers.js';
export {
  DOMAIN_EVENT_API_VERSION,
  DOMAIN_EVENT_PROTOCOL,
  assertDomainEvent,
  commandRejectedDomainEvent,
  createDomainEventQueue,
} from './domain-event.js';
export {
  DOMAIN_EVENT_DISPATCHER_API_VERSION,
  createDomainEventDispatcher,
} from './domain-event-dispatcher.js';
export {
  GAME_COMMAND_API_VERSION,
  assertGameCommand,
  createCommandDispatcher,
  createCommandFactory,
  createCommandLog,
  hashCommandState,
} from './game-command.js';
export { createGamePack } from './game-pack.js';
export { gameCommandFromInput, subscribeGameCommands } from './input-intent.js';
export {
  advanceSimulationTime,
  createGameClock,
  setSimulationPaused,
  setSimulationSpeed,
  setSimulationTime,
} from '../game-clock.js';
export { RANDOM_STREAMS_API_VERSION, createRandomStreams, createSeededRandom } from './random.js';
export {
  PRESENTATION_CUE_API_VERSION,
  PRESENTATION_CUE_PROTOCOL,
  createPresentationCueQueue,
} from './presentation-cue.js';
export { createRegistry } from './registry.js';
export {
  createFoundationStateSlice,
  createSlicedState,
  getStateSlice,
  hasStateSlices,
} from './state-slices.js';
export {
  attachRuntime,
  domainEventsFor,
  eventsFor,
  gamePackFor,
  hostFor,
  presentationCuesFor,
  publishDomainEventFor,
  randomFor,
  registryFor,
  runtimeFor,
  telemetryFor,
} from './runtime-context.js';
export {
  assertSerializableData,
  assertStableId,
  cloneSerializableData,
  compareCodePointStrings,
  deepFreezeData,
  immutableData,
} from './serializable-data.js';
