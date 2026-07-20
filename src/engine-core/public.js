// 跨系统使用的稳定基础契约入口；内部模块仍可按职责拆分。
export { CONTROLLER_API_VERSION } from './controller.js';
export { composeCommandHandlerMaps } from './command-handlers.js';
export {
  DOMAIN_EVENT_API_VERSION,
  DOMAIN_EVENT_PROTOCOL,
  assertDomainEvent,
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
export { gameCommandFromInput, subscribeGameCommands } from './input-intent.js';
export { createRandomStreams, createSeededRandom } from './random.js';
export {
  PRESENTATION_CUE_API_VERSION,
  PRESENTATION_CUE_PROTOCOL,
  createPresentationCueQueue,
} from './presentation-cue.js';
export { createRegistry } from './registry.js';
export { createSlicedState, getStateSlice, hasStateSlices } from './state-slices.js';
export {
  assertSerializableData,
  assertStableId,
  cloneSerializableData,
  deepFreezeData,
  immutableData,
} from './serializable-data.js';
