import assert from 'node:assert/strict';
import { createGameController } from '../src/game-controller.js';

{
  let resets = 0;
  const game = createGameController(2, () => { resets++; });
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
  assert.equal(resets, 2);
}

{
  const game = createGameController(5);
  assert.equal(game.state.stageIndex, 4);
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
  game.startStage(4);
  assert.equal(game.state.stageIndex, 1, '控制器不可进入未解锁关卡');
}

console.log('✓ 战败重试、胜利下一关与五星重玩控制链');
