// 兼容装配：Host 标准输入 → UI intent binding → LocalPlayerController → GameCommand。
import { createLocalPlayerController } from './controllers/local-player-controller.js';
import {
  createCommandDispatcher,
  createCommandLog,
  publishDomainEventFor,
} from './engine-core/public.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { createLocalCommandFeedback } from './presentation-pack/local-command-feedback.js';
import { snapshotMergeDefenseCommandState } from './rulesets/merge-defense/command-state.js';
import {
  createMergeDefenseCommandHandlers,
  createMergeDefenseInputQueries,
} from './rulesets/merge-defense/player-command-dispatcher.js';
import {
  createGameViewModel,
  createLocalInputBinding,
  createSemanticLayout,
  recordCommandResult,
  resetInteractionState,
} from './systems/ui-interaction/index.js';

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
  inputQueries,
  presentCommand,
  onCommandError,
} = {}) {
  resetInteractionState(drag);
  const layout = createSemanticLayout(gamePack.config);
  const handlers = createMergeDefenseCommandHandlers({ game, drag, gamePack });
  const dispatcher = createCommandDispatcher({
    handlers,
    authorize: game.authorize,
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
  // 交互结果由 UI 记录；Skin presenter 只消费结果生成像素和声音。
  const present = presentCommand ?? createLocalCommandFeedback({
    game,
    gamePack,
    audioEngine,
  });
  const controller = createLocalPlayerController({
    dispatch: dispatcher.dispatch,
    getTick,
    getTime: () => game.state.time,
    onSubmitted(command, result) {
      recordCommandResult(drag, command, result, game.state.time);
      present(command, result);
    },
  });
  const binding = createLocalInputBinding({
    inputSource,
    surface,
    layout,
    interaction: drag,
    getViewModel: () => createGameViewModel(game.state, drag, {
      stageCount: gamePack.config.campaign.stages.length,
      benchSize: gamePack.config.benchSize,
    }),
    submit: controller.submit,
    queries: inputQueries ?? createMergeDefenseInputQueries({ getState: () => game.state, gamePack }),
    onGesture: () => { void audioEngine.init?.(); },
  });
  let started = false;
  let destroyed = false;

  function start() {
    if (started || destroyed) return false;
    if (!controller.start()) return false;
    if (!binding.start()) return false;
    started = true;
    return true;
  }

  function destroy() {
    if (destroyed) return false;
    binding.destroy();
    controller.destroy();
    started = false;
    destroyed = true;
    return true;
  }

  return Object.freeze({
    controller,
    commandLog,
    dispatch: dispatcher.dispatch,
    start,
    destroy,
  });
}

// 兼容既有装配和测试；新应用壳使用 createLocalGameControl 取得日志与 Controller。
export function attachInput(inputSource, surface, game, drag, gamePack, audioEngine) {
  const control = createLocalGameControl({ inputSource, surface, game, drag, gamePack, audioEngine });
  control.start();
  return control.destroy;
}
