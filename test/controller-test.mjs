import assert from 'node:assert/strict';
import { createGameController } from '../src/game-controller.js';

{
  let resets = 0;
  const game = createGameController(2, () => { resets++; });
  assert.equal(game.state.stageIndex, 0, '刷新标题页默认选择第一关，不应直接跳到最高关');
  assert.equal(game.highestUnlockedStageIndex, 2);
  assert.equal(game.selectStage(2), true);
  assert.equal(game.state.stageIndex, 2);

  Object.assign(game.state, { title: false, over: true, win: false, saved: true });
  game.resolveResult();
  assert.equal(game.state.stageIndex, 2, '败北必须重试同一关');
  assert.equal(game.state.title, false);

  Object.assign(game.state, {
    over: true,
    win: true,
    saved: true,
    clearedStars: 3,
  });
  game.resolveResult();
  assert.equal(game.state.stageIndex, 3, '胜利后进入下一关');
  assert.equal(game.state.title, false);
  assert.equal(resets, 3, '选关、战败重试和胜利进关都应清理拖拽态');
}

{
  const game = createGameController(5);
  assert.equal(game.state.stageIndex, 0);
  game.selectStage(4);
  Object.assign(game.state, { title: false, over: true, win: true, saved: true });
  game.resolveResult();
  assert.equal(game.state.stageIndex, 4);
  assert.equal(game.state.title, true, '五星结算必须凯旋归营');
  game.startCurrentStage();
  assert.equal(game.state.stageIndex, 4);
  assert.equal(game.state.title, false, '五星标题页应能重玩第五关');
}

{
  const game = createGameController(1);
  assert.equal(game.selectStage(4), false, '标题页不可选择未解锁关卡');
  assert.equal(game.state.stageIndex, 0);
  game.startStage(4);
  assert.equal(game.state.stageIndex, 1, '控制器不可进入未解锁关卡');
}

{
  let cleared = 0;
  let resets = 0;
  const game = createGameController(4, () => { resets++; }, () => { cleared++; });
  game.selectStage(3);
  game.state.time = 7;
  assert.equal(game.requestProgressReset(), 'confirm');
  assert.equal(game.state.clearedStars, 4, '首次点击只确认，不可清存档');
  assert.ok(game.state.resetConfirmUntil > game.state.time);
  assert.equal(game.requestProgressReset(), 'cleared');
  assert.equal(cleared, 1);
  assert.equal(resets, 2, '选关和确认重置都会清理拖拽态');
  assert.equal(game.state.stageIndex, 0);
  assert.equal(game.state.clearedStars, 0);
  assert.equal(game.state.title, true);
}

{
  const game = createGameController(3, () => {}, () => false);
  game.state.time = 2;
  assert.equal(game.requestProgressReset(), 'confirm');
  assert.equal(game.requestProgressReset(), 'memory-only', '持久化删除失败不可误报成功');
  assert.equal(game.state.resetResult, 'memory-only');
  assert.equal(game.state.clearedStars, 0, '本次会话仍应回到第一关零星态');
}

console.log('✓ 标题选关、两步重置、战败重试、胜利下一关与五星重玩控制链');
