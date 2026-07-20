import { createGameController } from '../game-controller.js';
import { advanceBattle } from '../game-loop.js';
import { createLocalGameControl } from '../input.js';
import {
  createGameClock,
  createRandomStreams,
  immutableData,
} from '../engine-core/public.js';
import {
  assertHostContract,
  createLocalEventCollector,
  createSafeStorage,
  createScopedStorage,
} from '../platform-services/public.js';
import { createGameRuntime } from '../runtime.js';
import {
  applyLoadedProfileProgress,
  applySettledProfileProgress,
  createProgressSave,
} from '../systems/progress-save/index.js';
import {
  createSafeAudioAdapter,
  releasePresentationResources,
  renderGame,
} from '../systems/skin-presentation/index.js';
import {
  createInteractionState,
  createSemanticLayout,
  resetInteractionState,
} from '../systems/ui-interaction/index.js';
import { createMergeDefenseViewModel } from '../rulesets/merge-defense/view-model.js';
import { snapshotMergeDefenseCommandState } from '../rulesets/merge-defense/command-state.js';
import { createGameStatusSynchronizer } from './game-status.js';

function resetDragState(drag) {
  resetInteractionState(drag);
}

function legacyStateSnapshot(state) {
  return JSON.parse(JSON.stringify(state, (_key, value) => (
    value instanceof Set ? [...value] : value
  )));
}

export function createGameApp({ gamePack, host, services = {} } = {}) {
  if (!gamePack?.config) throw new TypeError('[app] gamePack is required');
  assertHostContract(host);
  const reportAdapterError = (error, source) => {
    try { services.onAdapterError?.(error, source); } catch { /* 诊断回调不能反向中断应用 */ }
  };
  const config = gamePack.config;
  const layout = createSemanticLayout(config);
  const eventCollector = services.eventCollector ?? createLocalEventCollector();
  const eventSink = services.eventSink ?? eventCollector;
  const random = services.random ?? createRandomStreams(services.randomSeed ?? host.scheduler.now());
  const safeAudio = createSafeAudioAdapter(host.audio, reportAdapterError);
  const drag = createInteractionState();
  const teardown = [];
  let game = null;
  let runtime = null;
  let storage = null;
  let clock = null;
  let syncStatus = null;
  let localControl = null;
  let progressSave = null;
  let commandLog = null;
  let logicTick = 0;
  let started = false;
  let destroyed = false;
  let appPaused = false;
  let sessionEnded = false;
  let destroyCompletion = Promise.resolve(false);

  function addTeardown(dispose, source) {
    if (typeof dispose !== 'function') throw new TypeError(`[app] ${source} must return an unsubscribe function`);
    teardown.push(dispose);
  }

  function rollbackStart() {
    started = false;
    for (const dispose of teardown.splice(0).reverse()) {
      try { dispose(); } catch (error) { reportAdapterError(error, 'dispose'); }
    }
    try { host.scheduler.cancelAll(); } catch (error) { reportAdapterError(error, 'scheduler.cancelAll'); }
    try { host.assets.destroy(); } catch (error) { reportAdapterError(error, 'assets.destroy'); }
    try { releasePresentationResources(host); } catch (error) { reportAdapterError(error, 'presentation.release'); }
    try { host.debug?.clear?.(); } catch (error) { reportAdapterError(error, 'debug.clear'); }
    resetDragState(drag);
    game = null;
    runtime = null;
    storage = null;
    clock = null;
    syncStatus = null;
    localControl = null;
    progressSave = null;
    commandLog = null;
    logicTick = 0;
    appPaused = false;
    sessionEnded = false;
  }

  function endSession(reason = 'destroy') {
    if (sessionEnded || !game) return;
    sessionEnded = true;
    const state = game.state;
    if (!state.title && !state.over) {
      game.abandon(reason);
    }
    runtime.events.emit('session_end', state, { result: 'ended', reason });
  }

  function step(forcedDt) {
    if (!started || destroyed || !game) return;
    logicTick++;
    runtime.setCurrentTick(logicTick);
    const current = game.state;
    const dt = forcedDt ?? clock.next(current.speed, appPaused);
    game.advance(dt, layout.cellXY, gamePack);
    const state = game.state;
    if (state.over && !state.saved) {
      const reached = state.win ? state.wave : Math.max(state.wave - 1, 0);
      const settled = progressSave.settleMatchResult({
        stageIndex: state.stageIndex,
        win: state.win,
        bestWave: reached,
      });
      applySettledProfileProgress(state, settled);
    }
    runtime.pumpDomainEvents(state);
    syncStatus(state);
  }

  function draw() {
    if (!started || destroyed || !game) return;
    try {
      const viewModel = createMergeDefenseViewModel(game.state, drag, gamePack, {
        highestUnlockedStageIndex: game.highestUnlockedStageIndex,
      });
      renderGame(host.surface.getContext(), viewModel, viewModel.interaction, gamePack, host);
    }
    catch (error) { reportAdapterError(error, 'render'); }
  }

  function pause() {
    if (!started || destroyed || appPaused) return false;
    appPaused = true;
    clock.reset();
    safeAudio.pause();
    return true;
  }

  function resume() {
    if (!started || destroyed || !appPaused) return false;
    appPaused = false;
    clock.reset();
    safeAudio.resume();
    return true;
  }

  function onLifecycle(event) {
    if (event?.type === 'background' || event?.type === 'interrupt') pause();
    else if (event?.type === 'foreground' || event?.type === 'resume') resume();
    else if (event?.type === 'exit') {
      endSession(event.reason ?? 'exit');
      destroy();
    }
  }

  function start() {
    if (started || destroyed) return false;
    try {
      const primary = createSafeStorage(host.storage);
      storage = createScopedStorage(primary, host.storage.scope ?? '');
      const manifest = gamePack.manifests.game;
      progressSave = createProgressSave({
        storage,
        identity: {
          gameId: manifest.id,
          gameVersion: gamePack.versions.gameVersion,
          rulesetVersion: gamePack.versions.rulesetVersion,
          contentVersion: gamePack.versions.contentVersion,
        },
        stageCount: gamePack.config.campaign.stages.length,
        keys: {
          profileKey: manifest.storage.profileKey ?? 'zyad_profile_progress',
          legacyProgressKey: manifest.storage.progressKey,
          legacyBestWaveKey: manifest.storage.bestWaveKey,
        },
      });
      const loadedProgress = progressSave.loadProfileProgress();
      const initialProgress = loadedProgress.profile.clearedStars;
      runtime = createGameRuntime(gamePack, {
        eventSink,
        events: services.events,
        host,
        random,
        onEventSinkError: reportAdapterError,
      });
      game = createGameController(
        initialProgress,
        () => resetDragState(drag),
        () => progressSave.clearProgress(),
        gamePack,
        runtime,
        advanceBattle,
      );
      applyLoadedProfileProgress(game.state, loadedProgress);
      clock = createGameClock(() => host.scheduler.now());
      localControl = createLocalGameControl({
        inputSource: host.input,
        surface: host.surface,
        game,
        drag,
        gamePack,
        audioEngine: safeAudio,
        getTick: () => logicTick,
        onCommandError: (error) => reportAdapterError(error, 'command.dispatch'),
      });
      commandLog = localControl.commandLog;
      syncStatus = createGameStatusSynchronizer({ game, gamePack, drag, storage, host, commandLog });
      host.surface.fit(config.canvas.w, config.canvas.h);
      addTeardown(
        host.surface.subscribeViewport(() => host.surface.fit(config.canvas.w, config.canvas.h)),
        'surface.subscribeViewport()',
      );
      addTeardown(localControl.destroy, 'LocalPlayerController.destroy()');
      if (!localControl.start()) throw new Error('[app] LocalPlayerController failed to start');
      addTeardown(host.lifecycle.subscribe(onLifecycle), 'lifecycle.subscribe()');
      started = true;
      syncStatus(game.state, true);
      addTeardown(host.scheduler.startLogicLoop(step, 33), 'scheduler.startLogicLoop()');
      addTeardown(host.scheduler.startRenderLoop(draw), 'scheduler.startRenderLoop()');
      host.debug?.expose?.({
        __game: game,
        __step: step,
        __events: eventCollector,
        __commands: commandLog,
        __controller: localControl.controller,
      });
      runtime.events.emit('session_start', game.state, { result: 'started', reason: 'app-load' });
      return true;
    } catch (error) {
      reportAdapterError(error, 'app.start');
      rollbackStart();
      return false;
    }
  }

  function destroy() {
    if (destroyed) return false;
    destroyed = true;
    try { endSession('destroy'); } catch (error) { reportAdapterError(error, 'session.end'); }
    for (const dispose of teardown.splice(0).reverse()) {
      try { dispose(); } catch (error) { reportAdapterError(error, 'dispose'); }
    }
    try { host.scheduler.cancelAll(); } catch (error) { reportAdapterError(error, 'scheduler.cancelAll'); }
    const audioDestroy = safeAudio.destroy();
    destroyCompletion = Promise.resolve(audioDestroy).then(() => true);
    try { host.assets.destroy(); } catch (error) { reportAdapterError(error, 'assets.destroy'); }
    try { releasePresentationResources(host); } catch (error) { reportAdapterError(error, 'presentation.release'); }
    try { host.debug?.clear?.(); } catch (error) { reportAdapterError(error, 'debug.clear'); }
    try { host.destroy?.(); } catch (error) { reportAdapterError(error, 'host.destroy'); }
    resetDragState(drag);
    started = false;
    return true;
  }

  // 保留 destroy() 的布尔兼容签名；需要等待原生音频异步关闭的 Host 可等待此契约。
  function whenDestroyed() {
    return destroyCompletion;
  }

  function getStateSnapshot() {
    if (!game) return null;
    // 保持当前 flat V2 诊断投影；确定性私有切片只在显式命名空间追加，不冒充旧 Save ABI。
    return immutableData({
      ...legacyStateSnapshot(game.state),
      runtimeSlices: {
        apiVersion: '1.0.0',
        commandState: snapshotMergeDefenseCommandState(game.state),
      },
    });
  }

  function getCommandLogSnapshot() {
    return commandLog ? commandLog.getEntries() : Object.freeze([]);
  }

  return Object.freeze({
    start,
    pause,
    resume,
    destroy,
    whenDestroyed,
    getStateSnapshot,
    getCommandLogSnapshot,
  });
}
