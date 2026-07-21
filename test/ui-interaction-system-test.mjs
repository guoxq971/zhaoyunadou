import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  UI_INTERACTION_API_VERSION,
  createInteractionCommandHandlers,
  createGameViewModel,
  createInteractionState,
  createLocalInputBinding,
  createSemanticLayout,
  layoutForGamePack,
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
assert.equal(layoutForGamePack(DEFAULT_GAME_PACK), layoutForGamePack(DEFAULT_GAME_PACK),
  '同一 Game Pack 必须复用语义布局，避免每帧重复分配');

const perspectiveLayout = createSemanticLayout(DEFAULT_GAME_PACK.config, {
  projection: {
    mode: 'shallow-perspective',
    topScale: 0.9,
    bottomScale: 1,
    verticalScale: 0.9,
  },
});
const topLeft = perspectiveLayout.cellPolygon(0, 0)[0];
const topRight = perspectiveLayout.cellPolygon(0, perspectiveLayout.board.cols - 1)[1];
const bottomLeft = perspectiveLayout.cellPolygon(perspectiveLayout.board.rows - 1, 0)[3];
const bottomRight = perspectiveLayout.cellPolygon(
  perspectiveLayout.board.rows - 1,
  perspectiveLayout.board.cols - 1,
)[2];
assert.ok(topRight.x - topLeft.x < bottomRight.x - bottomLeft.x,
  '浅透视棋盘顶部必须比底部稍窄');
assert.ok(perspectiveLayout.cellXY(9, 0).y < layout.cellXY(9, 0).y,
  '浅俯视必须压缩棋盘纵向高度');
for (const [row, column] of [[0, 0], [4, 3], [9, 7]]) {
  const center = perspectiveLayout.cellXY(row, column);
  assert.deepEqual(perspectiveLayout.boardCell(center.x, center.y), { r: row, c: column },
    '透视显示与点击命中必须使用同一套逆映射');
}
assert.equal(perspectiveLayout.boardCell(topLeft.x - 8, topLeft.y), null,
  '棋盘外的梯形留白不得误命中逻辑格');

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

const commandInteraction = createInteractionState();
let brushAvailable = true;
const invalidResults = [];
const interactionHandlers = createInteractionCommandHandlers({
  interaction: commandInteraction,
  querySource: () => ({
    item: { kind: 'troop', type: 'dao', level: 2 },
    signature: 'troop:dao:2',
    movable: true,
    draggableTool: false,
  }),
  queryItemAvailable: (itemId) => itemId === 'brush' && brushAvailable,
  invalid(command, reason) {
    invalidResults.push({ type: command.type, reason });
    return { ok: false, reason };
  },
});
assert.equal(interactionHandlers['interaction.drag_begin']({
  type: 'interaction.drag_begin', payload: { source: { zone: 'bench', index: 1 } },
}).ok, true);
assert.equal(commandInteraction.expectedSource, 'troop:dao:2');
assert.equal(commandInteraction.item.level, 2, '升级后的单位仍应进入同一拖拽链');
assert.deepEqual(interactionHandlers['interaction.drag_cancel'](), {
  ok: true, reason: 'none', active: true,
});
assert.equal(interactionHandlers['item.select_mode']({
  type: 'item.select_mode', payload: { itemId: 'brush' },
}).itemId, 'brush');
brushAvailable = false;
assert.deepEqual(interactionHandlers['item.select_mode']({
  type: 'item.select_mode', payload: { itemId: 'brush' },
}), { ok: false, reason: 'tool-unavailable' });
assert.deepEqual(invalidResults, [{ type: 'item.select_mode', reason: 'tool-unavailable' }]);

const trackedPiece = { kind: 'troop', type: 'dao', level: 1 };
Object.defineProperties(trackedPiece, {
  pieceId: { value: 'piece-view-model', writable: true },
  revision: { value: 3, writable: true },
  location: { value: { zone: 'bench', index: 0 }, writable: true },
});
const sourceState = {
  title: false,
  over: false,
  win: false,
  time: 9,
  speed: 1,
  phase: 'break',
  stageIndex: 2,
  grid: [[{ type: 'open', unit: null }]],
  bench: [trackedPiece, null],
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
  highestUnlockedStageIndex: viewModel.highestUnlockedStageIndex,
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
  highestUnlockedStageIndex: 0,
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
assert.ok(Object.isFrozen(viewModel.grid));
assert.ok(Object.isFrozen(viewModel.grid[0]));
assert.ok(Object.isFrozen(viewModel.grid[0][0]));
assert.deepEqual({
  pieceId: viewModel.bench[0].pieceId,
  revision: viewModel.bench[0].revision,
  location: viewModel.bench[0].location,
}, {
  pieceId: 'piece-view-model',
  revision: 3,
  location: { zone: 'bench', index: 0 },
}, 'ViewModel 必须保留 Piece 的非枚举稳定身份与 revision/location');
assert.throws(() => { viewModel.speed = 2; }, TypeError);
assert.throws(() => { viewModel.grid[0][0].type = 'corrupted'; }, TypeError);
assert.equal(sourceState.speed, 1, 'ViewModel 不得提供玩法状态写入口');
assert.equal(sourceState.grid[0][0].type, 'open', 'ViewModel 嵌套对象不得反向修改玩法状态');

let listener = null;
const inputSource = {
  subscribe(next) {
    listener = next;
    return () => { listener = null; };
  },
};
const submitted = [];
const presentationActions = [];
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
  onPresentationAction(type, payload) {
    presentationActions.push({ type, payload });
    return { ok: true };
  },
  queries: {
    findBrushTarget: () => ({ zone: 'grid', r: 0, c: 0 }),
    findDropTarget: () => ({ zone: 'grid', r: 0, c: 0 }),
  },
});

assert.equal(binding.start(), true);
assert.equal(binding.start(), false, '输入绑定不得重复订阅');
assert.equal(listener({
  type: 'pointer-down', pointerId: 9, primary: true, button: 0,
  x: layout.ui.themeSwitch.x + 2, y: layout.ui.themeSwitch.y + 2,
}), true);
assert.equal(listener({
  type: 'pointer-up', pointerId: 9, primary: true, button: 0,
  x: layout.ui.themeSwitch.x + 2, y: layout.ui.themeSwitch.y + 2,
}), false);
assert.deepEqual(presentationActions.at(-1), { type: 'presentation.theme.next', payload: {} });
assert.equal(submitted.length, 0, '表现主题切换不得伪装成 GameCommand');
assert.equal(listener({ type: 'key-down', code: 'KeyT' }), true);
assert.deepEqual(presentationActions.at(-1), { type: 'presentation.theme.next', payload: {} });
assert.equal(submitted.length, 0, '主题快捷键不得写入玩法命令日志');
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
const commandsBeforeBlockedRecruit = submitted.length;
assert.equal(listener({ type: 'key-down', code: 'KeyR' }), false);
assert.equal(submitted.length, commandsBeforeBlockedRecruit,
  '拖拽期的征兵快捷键由 UI 拦截，不把本地状态泄漏给玩法规则');
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
  'layout.js', 'interaction-state.js', 'command-handlers.js', 'view-model.js',
  'input-mapper.js', 'input-binding.js', 'index.js',
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
