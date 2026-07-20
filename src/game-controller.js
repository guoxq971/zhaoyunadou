// 页面无关的对局控制器，供浏览器装配与离线控制链测试共用。
import { normalizeClearedStars, normalizeStageIndex, resultAction, stageIndexForProgress } from './campaign.js';
import { createGame } from './state.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';

export function createGameController(
  initialProgress = 0,
  onReset = () => {},
  onProgressReset = () => true,
  gamePack = DEFAULT_GAME_PACK,
  runtime = { gamePack },
) {
  const events = runtime?.events;
  return {
    // 刷新后永远停在第一关选择态；已有进度只负责解锁，不再偷偷把玩家带到最高关。
    state: createGame(0, normalizeClearedStars(initialProgress, gamePack), gamePack, runtime),
    get highestUnlockedStageIndex() {
      return stageIndexForProgress(this.state.clearedStars, gamePack);
    },
    startStage(stageIndex, title = false, reason = 'player-start') {
      const highestUnlocked = this.highestUnlockedStageIndex;
      const safeStageIndex = Math.min(normalizeStageIndex(stageIndex, gamePack), highestUnlocked);
      this.state = createGame(safeStageIndex, this.state.clearedStars, gamePack, runtime);
      this.state.title = title;
      onReset();
      if (!title) events?.emit('stage_start', this.state, { result: 'started', reason });
    },
    selectStage(stageIndex) {
      if (!this.state.title) {
        events?.emit('invalid_action', this.state, { result: 'failure', reason: 'not-on-title', actionId: 'select-stage' });
        return false;
      }
      const index = Number(stageIndex);
      if (!Number.isInteger(index) || index < 0) {
        events?.emit('invalid_action', this.state, { result: 'failure', reason: 'invalid-stage', actionId: 'select-stage' });
        return false;
      }
      if (index > this.highestUnlockedStageIndex) {
        events?.emit('invalid_action', this.state, { result: 'failure', reason: 'stage-locked', actionId: 'select-stage' });
        return false;
      }
      if (index === this.state.stageIndex) {
        this.state.resetConfirmUntil = 0;
        return true;
      }
      const titleTime = this.state.time;
      this.state = createGame(index, this.state.clearedStars, gamePack, runtime);
      this.state.time = titleTime;
      onReset();
      return true;
    },
    cancelProgressReset() {
      this.state.resetConfirmUntil = 0;
    },
    requestProgressReset() {
      if (!this.state.title) return 'ignored';
      if (this.state.resetConfirmUntil <= this.state.time) {
        this.state.resetConfirmUntil = this.state.time + 3;
        return 'confirm';
      }
      const persisted = onProgressReset() !== false;
      this.state = createGame(0, 0, gamePack, runtime);
      this.state.title = true;
      this.state.resetResult = persisted ? 'cleared' : 'memory-only';
      onReset();
      return this.state.resetResult;
    },
    startCurrentStage() {
      this.cancelProgressReset();
      this.startStage(this.state.stageIndex);
    },
    restart() {
      events?.emit('retry', this.state, { result: 'started', reason: 'manual-retry' });
      this.startStage(this.state.stageIndex, false, 'retry');
    },
    quitToTitle(reason = 'player-quit') {
      if (this.state.title) return false;
      events?.emit('quit', this.state, { result: 'abandoned', reason });
      events?.emit('stage_end', this.state, { result: 'abandoned', reason });
      this.startStage(this.state.stageIndex, true, reason);
      return true;
    },
    resolveResult() {
      const action = resultAction(this.state);
      if (action.kind === 'replay') {
        events?.emit('retry', this.state, { result: 'started', reason: 'stage-defeat' });
      }
      this.startStage(
        action.stageIndex,
        action.kind === 'complete',
        action.kind === 'replay' ? 'retry' : 'advance',
      );
    },
  };
}
