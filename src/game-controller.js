// 页面无关的对局控制器，供浏览器装配与离线控制链测试共用。
import { normalizeClearedStars, normalizeStageIndex, resultAction, stageIndexForProgress } from './campaign.js';
import { createGame } from './state.js';

export function createGameController(
  initialProgress = 0,
  onReset = () => {},
  onProgressReset = () => true,
) {
  return {
    // 刷新后永远停在第一关选择态；已有进度只负责解锁，不再偷偷把玩家带到最高关。
    state: createGame(0, normalizeClearedStars(initialProgress)),
    get highestUnlockedStageIndex() {
      return stageIndexForProgress(this.state.clearedStars);
    },
    startStage(stageIndex, title = false) {
      const highestUnlocked = this.highestUnlockedStageIndex;
      const safeStageIndex = Math.min(normalizeStageIndex(stageIndex), highestUnlocked);
      this.state = createGame(safeStageIndex, this.state.clearedStars);
      this.state.title = title;
      onReset();
    },
    selectStage(stageIndex) {
      if (!this.state.title) return false;
      const index = Number(stageIndex);
      if (!Number.isInteger(index) || index < 0 || index > this.highestUnlockedStageIndex) return false;
      if (index === this.state.stageIndex) {
        this.state.resetConfirmUntil = 0;
        return true;
      }
      const titleTime = this.state.time;
      this.state = createGame(index, this.state.clearedStars);
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
      this.state = createGame(0, 0);
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
      this.startStage(this.state.stageIndex);
    },
    resolveResult() {
      const action = resultAction(this.state);
      this.startStage(action.stageIndex, action.kind === 'complete');
    },
  };
}
