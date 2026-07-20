// 输入装配：Host 标准输入 → LocalPlayerController → 语义 GameCommand → ruleset。
import { createLocalPlayerController } from './controllers/local-player-controller.js';
import { createCommandDispatcher, createCommandLog } from './engine-core/game-command.js';
import { publishDomainEventFor } from './engine-core/runtime-context.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { createLocalCommandFeedback } from './presentation-pack/local-command-feedback.js';
import { snapshotMergeDefenseCommandState } from './rulesets/merge-defense/command-state.js';
import {
  createMergeDefenseCommandHandlers,
  resetInteractionState,
} from './rulesets/merge-defense/player-command-dispatcher.js';

const NOOP_AUDIO = Object.freeze({ init: () => false, play: () => false });

export function createLocalGameControl({
  inputSource,
  surface,
  game,
  drag,
  gamePack = DEFAULT_GAME_PACK,
  audioEngine = NOOP_AUDIO,
  getTick = () => 0,
  commandLog = createCommandLog({
    limit: 256,
    header: {
      gameVersion: gamePack.versions.gameVersion,
      rulesetVersion: gamePack.versions.rulesetVersion,
      contentVersion: gamePack.versions.contentVersion,
    },
  }),
  onCommandError,
} = {}) {
  resetInteractionState(drag);
  const handlers = createMergeDefenseCommandHandlers({ game, drag, gamePack });
  const dispatcher = createCommandDispatcher({
    handlers,
    commandLog,
    getStateSummary: () => snapshotMergeDefenseCommandState(game.state),
    onRejected(command, result) {
      publishDomainEventFor(game.state, {
        type: 'command.rejected',
        source: 'foundation-runtime',
        tick: command.tick,
        payload: { commandType: command.type, reason: result.reason },
      });
    },
    onError: onCommandError,
  });
  const present = createLocalCommandFeedback({ game, drag, gamePack, audioEngine });
  const controller = createLocalPlayerController({
    inputSource,
    surface,
    game,
    drag,
    gamePack,
    dispatch: dispatcher.dispatch,
    present,
    getTick,
    onGesture: () => { void audioEngine.init?.(); },
  });
  return Object.freeze({
    controller,
    commandLog,
    dispatch: dispatcher.dispatch,
    start: controller.start,
    destroy: controller.destroy,
  });
}

// 兼容既有装配和测试；新应用壳使用 createLocalGameControl 取得日志与 Controller。
export function attachInput(inputSource, surface, game, drag, gamePack, audioEngine) {
  const control = createLocalGameControl({ inputSource, surface, game, drag, gamePack, audioEngine });
  control.start();
  return control.destroy;
}
