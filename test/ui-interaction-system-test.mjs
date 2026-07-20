import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  UI_INTERACTION_API_VERSION,
  createGameViewModel,
  createInteractionState,
  createLocalInputBinding,
  createSemanticLayout,
  recordCommandResult,
  resetInteractionState,
} from '../src/systems/ui-interaction/index.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';

assert.equal(UI_INTERACTION_API_VERSION, '1.0.0');

const layout = createSemanticLayout(DEFAULT_GAME_PACK.config);
assert.deepEqual(layout.board, DEFAULT_GAME_PACK.config.board);
assert.deepEqual(layout.ui.recruit, { x: 142, y: 606, w: 136, h: 62 });
assert.deepEqual(layout.boardCell(layout.board.ox, layout.board.oy), { r: 0, c: 0 });
assert.equal(layout.boardCell(layout.board.ox - 0.01, layout.board.oy), null);
assert.deepEqual(layout.benchRect(4), { x: 286, y: 542, w: 48, h: 48 });
assert.ok(Object.isFrozen(layout));
assert.ok(Object.isFrozen(layout.ui));

const interaction = createInteractionState({ mode: 'brush' });
assert.equal(interaction.mode, 'brush');
recordCommandResult(interaction, {
  type: 'battle.batch_recruit', sequence: 7,
}, {
  ok: true, reason: 'none', filledCount: 3, totalCost: 54, stopReason: 'bench-full',
}, 12);
assert.deepEqual(interaction.lastCommand, {
  type: 'battle.batch_recruit', ok: true, reason: 'none', action: '', sequence: 7, until: 14.2,
});
assert.deepEqual(interaction.lastRecruitBatch, {
  filledCount: 3, totalCost: 54, stopReason: 'bench-full', until: 14.8,
});
resetInteractionState(interaction);
assert.equal(interaction.item, null);
assert.equal(interaction.mode, null);
assert.equal(interaction.lastCommand, null);
assert.equal(interaction.lastRecruitBatch, null);

const sourceState = {
  title: false,
  over: false,
  win: false,
  time: 9,
  speed: 1,
  phase: 'break',
  stageIndex: 2,
  grid: [[{ type: 'open', unit: null }]],
  bench: [null, null],
};
const viewModel = createGameViewModel(sourceState, interaction, {
  stageCount: 5,
  benchSize: 2,
});
assert.deepEqual({
  screen: viewModel.screen,
  title: viewModel.title,
  over: viewModel.over,
  win: viewModel.win,
  time: viewModel.time,
  speed: viewModel.speed,
  phase: viewModel.phase,
  stageIndex: viewModel.stageIndex,
  stageCount: viewModel.stageCount,
  benchSize: viewModel.benchSize,
}, {
  screen: 'battle',
  title: false,
  over: false,
  win: false,
  time: 9,
  speed: 1,
  phase: 'break',
  stageIndex: 2,
  stageCount: 5,
  benchSize: 2,
});
assert.deepEqual({
  item: viewModel.interaction.item,
  mode: viewModel.interaction.mode,
  source: viewModel.interaction.source,
  expectedSource: viewModel.interaction.expectedSource,
}, { item: null, mode: null, source: null, expectedSource: null });
assert.ok(Object.isFrozen(viewModel));
assert.ok(Object.isFrozen(viewModel.interaction));
assert.throws(() => { viewModel.speed = 2; }, TypeError);
assert.equal(sourceState.speed, 1, 'ViewModel 不得提供玩法状态写入口');

let listener = null;
const inputSource = {
  subscribe(next) {
    listener = next;
    return () => { listener = null; };
  },
};
const submitted = [];
const mutableView = { ...viewModel, title: true, screen: 'title', stageIndex: 0 };
const binding = createLocalInputBinding({
  inputSource,
  surface: { focus() {} },
  layout,
  interaction,
  getViewModel: () => mutableView,
  submit(type, payload) {
    submitted.push({ type, payload });
    if (type === 'interaction.drag_begin') {
      interaction.item = { kind: 'troop', type: 'dao', level: 1 };
      interaction.source = payload.source;
      interaction.expectedSource = 'troop:dao:1';
    }
    if (type === 'interaction.drag_cancel' || type === 'unit.drop') resetInteractionState(interaction);
    return { ok: true, reason: 'none' };
  },
  queries: {
    findBrushTarget: () => ({ zone: 'grid', r: 0, c: 0 }),
    findDropTarget: () => ({ zone: 'grid', r: 0, c: 0 }),
  },
});

assert.equal(binding.start(), true);
assert.equal(binding.start(), false, '输入绑定不得重复订阅');
const stageRect = layout.titleStageRect(1);
assert.equal(listener({
  type: 'pointer-down', pointerId: 1, primary: true, button: 0,
  x: stageRect.x + 1, y: stageRect.y + 1,
}), true);
assert.deepEqual(submitted.at(-1), { type: 'campaign.select_stage', payload: { stageIndex: 1 } });
assert.equal(listener({
  type: 'pointer-up', pointerId: 1, primary: true, button: 0,
  x: stageRect.x + 1, y: stageRect.y + 1,
}), false);
const titleCommandCount = submitted.length;
assert.equal(listener({ type: 'key-down', code: 'KeyP' }), false);
assert.equal(submitted.length, titleCommandCount, '标题页快捷键不得误发战斗命令');

mutableView.title = false;
mutableView.screen = 'battle';
const bench = layout.benchRect(0);
assert.equal(listener({
  type: 'pointer-down', pointerId: 2, primary: true, button: 0,
  x: bench.x + 10, y: bench.y + 10,
}), true);
assert.equal(listener({
  type: 'pointer-move', pointerId: 2, primary: true, button: 0,
  x: layout.board.ox + 10, y: layout.board.oy + 10,
}), true);
assert.deepEqual(interaction.hover, { zone: 'grid', r: 0, c: 0 });
assert.equal(listener({
  type: 'pointer-up', pointerId: 2, primary: true, button: 0,
  x: layout.board.ox + 10, y: layout.board.oy + 10,
}), true);
assert.equal(submitted.at(-1).type, 'unit.drop');
assert.doesNotThrow(() => JSON.stringify(submitted), '输入映射结果必须可序列化');

interaction.item = { kind: 'troop', type: 'dao', level: 1 };
interaction.source = { zone: 'bench', index: 0 };
interaction.expectedSource = 'troop:dao:1';
assert.equal(listener({ type: 'key-down', code: 'Enter' }), true);
assert.deepEqual(submitted.at(-1), {
  type: 'unit.drop',
  payload: {
    source: { zone: 'bench', index: 0 },
    target: { zone: 'grid', r: 0, c: 0 },
    expectedSource: 'troop:dao:1',
  },
});

interaction.item = { kind: 'troop', type: 'dao', level: 1 };
interaction.source = { zone: 'bench', index: 0 };
assert.equal(binding.destroy(), true);
assert.equal(binding.destroy(), false);
assert.equal(listener, null);
assert.equal(submitted.at(-1).type, 'interaction.drag_cancel', '销毁绑定必须取消活动拖拽');

const uiSources = await Promise.all([
  'layout.js', 'interaction-state.js', 'view-model.js', 'input-mapper.js', 'input-binding.js', 'index.js',
].map((file) => readFile(new URL(`../src/systems/ui-interaction/${file}`, import.meta.url), 'utf8')));
for (const source of uiSources) {
  assert.doesNotMatch(source, /(?:presentation-pack|skin-presentation|logic\.js|rulesets\/|systems\/economy|systems\/combat)/,
    'UI 系统不得导入 Skin 或玩法实现');
}

const controllerSource = await readFile(
  new URL('../src/controllers/local-player-controller.js', import.meta.url),
  'utf8',
);
assert.doesNotMatch(controllerSource, /logic\.js|ui-layout\.js|subscribeGameCommands|inputSource/,
  'LocalPlayerController 只能创建并提交 GameCommand');

console.log('✓ UI 布局、交互态、只读 ViewModel、输入绑定与纯 GameCommand Controller 边界');
