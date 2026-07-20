// 兼容门面：旧调用方继续使用 createGameController，真实生命周期由 MatchMode 拥有。
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { createGame } from './state.js';
import { createFixedRouteCampaignMode } from './systems/match-mode/index.js';

const noAdvance = () => undefined;

export function createGameController(
  initialProgress = 0,
  onReset = () => {},
  onProgressReset = () => true,
  gamePack = DEFAULT_GAME_PACK,
  runtime = { gamePack },
  advanceRules = noAdvance,
) {
  if (typeof advanceRules !== 'function') {
    throw new TypeError('[game-controller] advanceRules must be a function');
  }
  return createFixedRouteCampaignMode({
    initialProgress,
    gamePack,
    createState: (stageIndex, clearedStars, pack) => (
      createGame(stageIndex, clearedStars, pack, runtime)
    ),
    advanceRules(state, dt, ...args) {
      const result = advanceRules(state, dt, ...args);
      return result ?? { advanced: dt };
    },
    onInteractionReset: onReset,
    clearProgress: onProgressReset,
    publishDomainEvent: (state, definition) => (
      runtime?.publishDomainEvent?.(definition, state) ?? null
    ),
    getTick: () => runtime?.currentTick?.() ?? 0,
  });
}
