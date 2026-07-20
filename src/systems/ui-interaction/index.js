export const UI_INTERACTION_API_VERSION = '1.0.0';

export { createSemanticLayout, DEFAULT_UI_RECTS, layoutForGamePack } from './layout.js';
export {
  createInteractionState,
  recordCommandResult,
  resetInteractionState,
  setInteractionMode,
  setPointerFeedback,
} from './interaction-state.js';
export { createGameViewModel } from './view-model.js';
export { createLocalInputMapper, pointerLocation } from './input-mapper.js';
export { createLocalInputBinding } from './input-binding.js';
export { createInteractionCommandHandlers } from './command-handlers.js';
