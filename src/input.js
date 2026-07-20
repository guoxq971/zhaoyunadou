// 兼容装配：Host 标准输入 → UI intent binding → LocalPlayerController → GameCommand。
import {
  createCommandDispatcher,
  createCommandLog,
  publishDomainEventFor,
  runtimeFor,
} from './engine-core/public.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { snapshotMergeDefenseCommandState } from './rulesets/merge-defense/command-state.js';
import {
  createMergeDefenseCommandHandlers,
  createMergeDefenseInputQueries,
} from './rulesets/merge-defense/player-command-dispatcher.js';
import { createLocalPlayerController } from './systems/match-mode/index.js';
import { createLocalCommandFeedback } from './systems/skin-presentation/index.js';
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
  commandLog = null,
  inputQueries,
  presentCommand,
  onCommandError,
} = {}) {
  resetInteractionState(drag);
  const activeCommandLog = commandLog ?? createCommandLog({
    limit: 256,
    header: {
      gameVersion: gamePack.versions.gameVersion,
      rulesetVersion: gamePack.versions.rulesetVersion,
      contentVersion: gamePack.versions.contentVersion,
      random: runtimeFor(game.state)?.random?.snapshot?.() ?? null,
    },
  });
  const layout = createSemanticLayout(gamePack.config);
  const handlers = createMergeDefenseCommandHandlers({ game, drag, gamePack });
  const dispatcher = createCommandDispatcher({
    handlers,
    authorize: game.authorize,
    commandLog: activeCommandLog,
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
      highestUnlockedStageIndex: game.highestUnlockedStageIndex,
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
    try {
      if (!binding.start()) {
        binding.destroy();
        controller.destroy();
        destroyed = true;
        return false;
      }
      started = true;
      return true;
    } catch (error) {
      binding.destroy();
      controller.destroy();
      destroyed = true;
      throw error;
    }
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
    commandLog: activeCommandLog,
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
