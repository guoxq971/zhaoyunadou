// 跨系统使用的稳定基础契约入口；内部模块仍可按职责拆分。
export { CONTROLLER_API_VERSION } from './controller.js';
export {
  GAME_COMMAND_API_VERSION,
  assertGameCommand,
  createCommandDispatcher,
  createCommandFactory,
  createCommandLog,
  hashCommandState,
} from './game-command.js';
export { subscribeGameCommands } from './game-command-source.js';
export { createRandomStreams, createSeededRandom } from './random.js';
export { createRegistry } from './registry.js';
