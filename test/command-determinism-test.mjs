import assert from 'node:assert/strict';
import {
  createCommandDispatcher,
  createCommandFactory,
  createCommandLog,
  hashCommandState,
} from '../src/engine-core/game-command.js';
import { createRandomStreams } from '../src/engine-core/random.js';
import { createGameController } from '../src/game-controller.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGameRuntime } from '../src/runtime.js';
import { createLocalEventCollector } from '../src/platform-services/local-event-collector.js';
import { snapshotMergeDefenseCommandState } from '../src/rulesets/merge-defense/command-state.js';
import {
  PLAYER_COMMAND_TYPES,
  createMergeDefenseCommandHandlers,
} from '../src/rulesets/merge-defense/player-command-dispatcher.js';

assert.deepEqual([...PLAYER_COMMAND_TYPES].sort(), [
  'battle.batch_recruit', 'battle.retry', 'battle.set_paused', 'battle.set_speed', 'battle.start_wave',
  'campaign.reset_progress', 'campaign.select_stage', 'campaign.start_stage',
  'interaction.drag_begin', 'interaction.drag_cancel', 'item.relocate', 'item.select_mode', 'item.use',
  'result.resolve', 'session.quit', 'unit.drop',
].sort(), '当前所有玩家状态动作必须具备稳定语义命令类型');

function run(seed) {
  const runtime = createGameRuntime(DEFAULT_GAME_PACK, { random: createRandomStreams(seed), now: () => 0 });
  const game = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, runtime);
  game.startCurrentStage();
  game.state.recruitQueue = [];
  const drag = { item: null, mode: null };
  const handlers = createMergeDefenseCommandHandlers({ game, drag, gamePack: DEFAULT_GAME_PACK });
  const log = createCommandLog({ limit: 32 });
  const dispatcher = createCommandDispatcher({
    handlers,
    commandLog: log,
    getStateSummary: () => snapshotMergeDefenseCommandState(game.state),
  });
  const factory = createCommandFactory({
    actorId: 'local-player', side: 'player', getTick: () => 4, getTime: () => game.state.time,
  });
  const submit = (type, payload = {}) => dispatcher.dispatch(factory.create(type, payload));
  const expected0 = 'troop:qiang:1';
  submit('unit.drop', {
    source: { zone: 'bench', index: 0 },
    target: { zone: 'grid', r: 4, c: 4 },
    expectedSource: expected0,
  });
  submit('battle.batch_recruit');
  const rejected = submit('unit.drop', {
    source: { zone: 'grid', r: 4, c: 4 },
    target: { zone: 'grid', r: 0, c: 7 },
    expectedSource: expected0,
  });
  return {
    rejected,
    final: snapshotMergeDefenseCommandState(game.state),
    entries: log.getEntries(),
  };
}

const first = run('g1-command-seed');
const second = run('g1-command-seed');
assert.deepEqual(first, second, '相同初态、seed 与命令序列必须得到相同结果和关键状态 hash');
assert.deepEqual(first.rejected, { ok: false, reason: 'target-not-open' });
assert.ok(first.entries.every(({ command, stateHash }) => JSON.stringify(command) && /^[0-9a-f]{8}$/.test(stateHash)));
assert.notDeepEqual(first.final.bench, run('other-seed').final.bench, '不同 seed 可改变随机征兵结果');

{
  const collector = createLocalEventCollector();
  const runtime = createGameRuntime(DEFAULT_GAME_PACK, { eventSink: collector });
  const game = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, runtime);
  const drag = { item: null, mode: null };
  const dispatcher = createCommandDispatcher({
    handlers: createMergeDefenseCommandHandlers({ game, drag, gamePack: DEFAULT_GAME_PACK }),
    getStateSummary: () => snapshotMergeDefenseCommandState(game.state),
  });
  const factory = createCommandFactory({ actorId: 'local-player', side: 'player' });
  assert.deepEqual(dispatcher.dispatch(factory.create('campaign.select_stage', { stageIndex: -1 })), {
    ok: false, reason: 'invalid-stage',
  });
  assert.deepEqual(dispatcher.dispatch(factory.create('campaign.start_stage', { stageIndex: -1 })), {
    ok: false, reason: 'invalid-stage',
  });
  game.startCurrentStage();
  assert.deepEqual(dispatcher.dispatch(factory.create('campaign.select_stage', { stageIndex: 0 })), {
    ok: false, reason: 'not-on-title',
  });
  assert.deepEqual(dispatcher.dispatch(factory.create('campaign.reset_progress', { action: 'request' })), {
    ok: false, reason: 'not-on-title', action: 'ignored',
  });
  assert.deepEqual(collector.getEvents().filter(({ eventId }) => eventId === 'invalid_action').map(({ reason }) => reason),
    ['invalid-stage', 'invalid-stage', 'not-on-title', 'not-on-title'],
    '命令结果和 invalid_action 原因必须一致');
}

{
  const game = createGameController(0);
  const initial = hashCommandState(snapshotMergeDefenseCommandState(game.state));
  game.state.spawnT = 0.25;
  assert.notEqual(hashCommandState(snapshotMergeDefenseCommandState(game.state)), initial,
    '状态 hash 必须检出下一次出怪时间差异');
  game.state.spawnT = 0;
  game.state.luoyang.elapsed = 1;
  assert.notEqual(hashCommandState(snapshotMergeDefenseCommandState(game.state)), initial,
    '状态 hash 必须检出洛阳铲计时差异');
  game.state.luoyang.elapsed = 0;
  game.state.buff = { mult: 1.4, until: 2 };
  assert.notEqual(hashCommandState(snapshotMergeDefenseCommandState(game.state)), initial,
    '状态 hash 必须检出会影响伤害的光环差异');
  game.state.buff = null;
  game.state.clearedStars = 1;
  assert.notEqual(hashCommandState(snapshotMergeDefenseCommandState(game.state)), initial,
    '状态 hash 必须检出会影响选关和结算的进度差异');
  game.state.clearedStars = 0;
  const enemy = {
    type: 'normal', wave: 1, lane: 0, hp: 10, maxHp: 10,
    p: 0, speed: 1, stun: 0, bob: 0,
  };
  game.state.enemies = [enemy];
  const enemyHash = hashCommandState(snapshotMergeDefenseCommandState(game.state));
  enemy.bob = 1;
  assert.equal(hashCommandState(snapshotMergeDefenseCommandState(game.state)), enemyHash,
    '纯表现浮动不应污染玩法 hash');
  enemy.speed = 2;
  assert.notEqual(hashCommandState(snapshotMergeDefenseCommandState(game.state)), enemyHash,
    '状态 hash 必须检出敌军速度差异');
  game.state.effects = [{
    kind: 'dragon', lane: 0, p: 2, t: 0.2, speed: 14, life: 5,
    hitDistance: 1.2, hit: new Set([enemy]),
  }];
  assert.deepEqual(snapshotMergeDefenseCommandState(game.state).dragons[0], {
    lane: 0, p: 2, t: 0.2, speed: 14, life: 5, hitDistance: 1.2, hit: [0],
  }, '火龙 hash 只记玩法参数和当前敌军索引，不嵌入整个对象');
  game.state.grid[4][2].unit = { kind: 'troop', type: 'nong', level: 1 };
  const uninitializedCooldown = hashCommandState(snapshotMergeDefenseCommandState(game.state));
  game.state.grid[4][2].unit.cd = 0;
  assert.notEqual(hashCommandState(snapshotMergeDefenseCommandState(game.state)), uninitializedCooldown,
    '农民冷却未初始化和立即产出的 0 必须是不同玩法状态');
}

{
  const runtime = createGameRuntime(DEFAULT_GAME_PACK, { random: createRandomStreams('swap-hero') });
  const game = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, runtime);
  game.startCurrentStage();
  game.state.grid[4][2].unit = { kind: 'frag', char: '赵', level: 1 };
  game.state.grid[4][3].unit = { kind: 'troop', type: 'dao', level: 1 };
  game.state.grid[5][4].unit = { kind: 'frag', char: '云', level: 1 };
  const drag = { item: null, mode: null };
  const dispatcher = createCommandDispatcher({
    handlers: createMergeDefenseCommandHandlers({ game, drag, gamePack: DEFAULT_GAME_PACK }),
    getStateSummary: () => snapshotMergeDefenseCommandState(game.state),
  });
  const factory = createCommandFactory({ actorId: 'local-player', side: 'player' });
  const result = dispatcher.dispatch(factory.create('unit.drop', {
    source: { zone: 'grid', r: 4, c: 3 },
    target: { zone: 'grid', r: 5, c: 4 },
    expectedSource: 'troop:dao:1',
  }));
  assert.equal(result.action, 'swap');
  assert.equal(result.heroUnlocked, 'zhaoyun', '交换回源格的英雄字也必须触发拼将');
  assert.deepEqual(game.state.heroes.map(({ key }) => key), ['zhaoyun']);
}

{
  const runtime = createGameRuntime(DEFAULT_GAME_PACK, { random: createRandomStreams('merge-hero') });
  const game = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, runtime);
  game.startCurrentStage();
  game.state.bench[0] = { kind: 'frag', char: '赵', level: 1 };
  game.state.grid[4][2].unit = { kind: 'frag', char: '赵', level: 1 };
  game.state.grid[4][3].unit = { kind: 'frag', char: '云', level: 2 };
  const drag = { item: null, mode: null };
  const dispatcher = createCommandDispatcher({
    handlers: createMergeDefenseCommandHandlers({ game, drag, gamePack: DEFAULT_GAME_PACK }),
    getStateSummary: () => snapshotMergeDefenseCommandState(game.state),
  });
  const factory = createCommandFactory({ actorId: 'local-player', side: 'player' });
  const result = dispatcher.dispatch(factory.create('unit.drop', {
    source: { zone: 'bench', index: 0 },
    target: { zone: 'grid', r: 4, c: 2 },
    expectedSource: 'frag:赵:1',
  }));
  assert.equal(result.action, 'merge');
  assert.equal(result.heroUnlocked, 'zhaoyun', '合成升级后与相邻同级英雄字应立即拼将');
  assert.deepEqual(game.state.heroes.map(({ key, level }) => [key, level]), [['zhaoyun', 2]]);
}

{
  const runtime = createGameRuntime(DEFAULT_GAME_PACK, { random: createRandomStreams('invalid-item-target') });
  const game = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, runtime);
  game.startCurrentStage();
  game.state.bench[4] = { kind: 'shovel' };
  const drag = { item: null, mode: null };
  const handlers = createMergeDefenseCommandHandlers({ game, drag, gamePack: DEFAULT_GAME_PACK });
  const dispatcher = createCommandDispatcher({
    handlers,
    getStateSummary: () => snapshotMergeDefenseCommandState(game.state),
  });
  const factory = createCommandFactory({ actorId: 'local-player', side: 'player' });
  const before = JSON.stringify(game.state.bench);
  const result = dispatcher.dispatch(factory.create('item.relocate', {
    source: { zone: 'bench', index: 4 },
    target: { zone: 'bench', index: -1 },
    expectedSource: 'shovel',
  }));
  assert.deepEqual(result, { ok: false, reason: 'invalid-target' });
  assert.equal(JSON.stringify(game.state.bench), before, '非法营位不得造成道具丢失或越界属性');
}

console.log('✓ 语义 GameCommand 同 seed/动作序列结果与关键状态哈希一致');
