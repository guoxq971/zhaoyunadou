import assert from 'node:assert/strict';
import { assertControllerContract } from '../src/engine-core/controller.js';
import { createGameController } from '../src/game-controller.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createLocalGameControl } from '../src/input.js';
import { resetInteractionState } from '../src/rulesets/merge-defense/player-command-dispatcher.js';
import { benchRect, UI } from '../src/ui-layout.js';

let listener = null;
const inputSource = {
  subscribe(next) {
    listener = next;
    return () => { listener = null; };
  },
};
const game = createGameController(0);
game.startCurrentStage();
const drag = { item: null, x: 0, y: 0, mode: null };
const surface = { focus() {} };
const control = createLocalGameControl({
  inputSource,
  surface,
  game,
  drag,
  gamePack: DEFAULT_GAME_PACK,
  getTick: () => 7,
  audioEngine: { init: () => true, play: () => true },
});

assertControllerContract(control.controller);
assert.equal(control.start(), true);
assert.equal(control.start(), false, 'Controller 不得重复订阅输入');

const original = game.state.bench[0];
const slot0 = benchRect(0);
const slot1 = benchRect(1);
listener({
  type: 'pointer-down', pointerId: 1, primary: true, button: 0,
  x: slot0.x + 20, y: slot0.y + 20,
});
assert.equal(game.state.bench[0], original, 'drag_begin 只保留源位置，不得提前移除单位');
listener({
  type: 'pointer-up', pointerId: 1, primary: true, button: 0,
  x: slot1.x + 20, y: slot1.y + 20,
});
assert.equal(game.state.bench[1], original, '营栏占位落点应执行交换');

listener({
  type: 'pointer-down', pointerId: 9, primary: true, button: 2,
  x: UI.recruit.x + 20, y: UI.recruit.y + 20,
});
listener({
  type: 'pointer-up', pointerId: 9, primary: true, button: 2,
  x: UI.recruit.x + 20, y: UI.recruit.y + 20,
});
assert.equal(control.commandLog.size, 2, '鼠标右键不得触发玩法命令');
assert.equal(game.state.stats.recruits, 0);

listener({
  type: 'pointer-down', pointerId: 2, primary: true, button: 0,
  x: UI.recruit.x + 20, y: UI.recruit.y + 20,
});
listener({
  type: 'pointer-up', pointerId: 2, primary: true, button: 0,
  x: UI.recruit.x + 20, y: UI.recruit.y + 20,
});
const entries = control.commandLog.getEntries();
assert.deepEqual(entries.map(({ command }) => command.type), [
  'interaction.drag_begin',
  'unit.drop',
  'battle.batch_recruit',
]);
assert.deepEqual(entries.map(({ command }) => command.sequence), [1, 2, 3]);
assert.ok(entries.every(({ command }) => command.actorId === 'local-player' && command.side === 'player'));
assert.ok(entries.every(({ command }) => command.tick === 7));
assert.equal(game.state.stats.recruits, 1, '一次命令应填满交换后仍存在的唯一空营位');
assert.equal(entries.at(-1).result.stopReason, 'bench-full');

Object.assign(game.state, { over: true, win: false });
listener({
  type: 'pointer-down', pointerId: 3, primary: true, button: 0,
  x: UI.restart.x + UI.restart.w / 2, y: UI.restart.y + UI.restart.h / 2,
});
assert.equal(control.commandLog.getEntries().at(-1).command.type, 'battle.retry',
  '战败重试必须是独立、可回放的语义命令');

assert.equal(control.destroy(), true);
assert.equal(control.destroy(), false);
assert.equal(listener, null, 'Controller 销毁后必须注销输入');
const stateAfterDestroy = JSON.stringify(game.state);
const logAfterDestroy = control.commandLog.size;
assert.deepEqual(control.controller.submit('battle.batch_recruit'), {
  ok: false, reason: 'controller-destroyed',
});
assert.equal(JSON.stringify(game.state), stateAfterDestroy, '销毁后的 Controller 引用不得继续改写玩法');
assert.equal(control.commandLog.size, logAfterDestroy, '销毁后拒绝不得伪造可回放命令');

const staleDrag = {
  item: { kind: 'troop', type: 'dao', level: 2 },
  source: { zone: 'grid', r: 4, c: 4 },
  hover: { zone: 'grid', r: 4, c: 5 },
  lastCommand: { type: 'battle.batch_recruit', ok: true },
  lastRecruitBatch: { filledCount: 2, totalCost: 36, stopReason: 'insufficient-mantou' },
};
resetInteractionState(staleDrag);
assert.equal(staleDrag.item, null);
assert.equal(staleDrag.source, null);
assert.equal(staleDrag.hover, null);
assert.equal(staleDrag.lastCommand, null, '新关卡不得残留上一关操作状态');
assert.equal(staleDrag.lastRecruitBatch, null, '新关卡不得残留上一关批量征兵反馈');

console.log('✓ LocalPlayerController 语义命令、元数据、交换与可注销订阅');
