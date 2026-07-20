// 页面无关的对局控制器，供浏览器装配与离线控制链测试共用。
import { normalizeStageIndex, resultAction, stageIndexForProgress } from './campaign.js';
import { createGame } from './state.js';

export function createGameController(initialProgress = 0, onReset = () => {}) {
  return {
    state: createGame(stageIndexForProgress(initialProgress), initialProgress),
    startStage(stageIndex, title = false) {
      const highestUnlocked = stageIndexForProgress(this.state.clearedStars);
      const safeStageIndex = Math.min(normalizeStageIndex(stageIndex), highestUnlocked);
      this.state = createGame(safeStageIndex, this.state.clearedStars);
      this.state.title = title;
      onReset();
    },
    startCurrentStage() {
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
