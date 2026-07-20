import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGameRuntime } from '../src/runtime.js';
import { createGameController } from '../src/game-controller.js';
import { createLocalEventCollector } from '../src/platform-services/local-event-collector.js';
import { attemptRecruit } from '../src/actions.js';
import { detectHero, unlockHero } from '../src/logic.js';
import { updateHeroes } from '../src/heroes.js';
import { updateEnemies, updateWaves } from '../src/enemies.js';
import { cellXY } from '../src/ui-layout.js';
import { createEquipmentCommandHandlers } from '../src/systems/equipment-items/index.js';

const collector = createLocalEventCollector();
const runtime = createGameRuntime(DEFAULT_GAME_PACK, {
  eventSink: collector,
  sessionId: 'integration-test',
  now: () => 1_000,
});
const game = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, runtime);

{
  const shovelCollector = createLocalEventCollector();
  const shovelRuntime = createGameRuntime(DEFAULT_GAME_PACK, {
    eventSink: shovelCollector,
    sessionId: 'shovel-atomic-test',
    now: () => 1_000,
  });
  const shovelGame = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, shovelRuntime);
  shovelGame.startCurrentStage();
  const locked = shovelGame.state.grid
    .flatMap((row, r) => row.map((cell, c) => ({ cell, r, c })))
    .find(({ cell }) => cell.type === 'locked');
  const handlers = createEquipmentCommandHandlers({
    game: shovelGame,
    drag: {},
    gamePack: DEFAULT_GAME_PACK,
    invalid: (_command, reason) => ({ ok: false, reason }),
    clearDrag: () => {},
  });
  const result = handlers['item.use']({
    type: 'item.use', tick: 4,
    payload: {
      itemId: 'shovel', source: { zone: 'bench', index: 3 },
      target: { zone: 'grid', r: locked.r, c: locked.c },
    },
  });
  assert.equal(result.ok, true);
  const deploy = shovelCollector.getEvents().find(({ eventId }) => eventId === 'deploy');
  assert.equal(deploy.source, 'bench');
  assert.equal(deploy.resourceSnapshot.benchUsed, 3,
    '铲地 Telemetry 必须在开格、扣库存与移除营栏铲子全部提交后采样');
}

{
  const modeCollector = createLocalEventCollector();
  const modeRuntime = createGameRuntime(DEFAULT_GAME_PACK, {
    eventSink: modeCollector,
    sessionId: 'shovel-mode-source-test',
    now: () => 1_000,
  });
  const modeGame = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, modeRuntime);
  modeGame.startCurrentStage();
  const locked = modeGame.state.grid
    .flatMap((row, r) => row.map((cell, c) => ({ cell, r, c })))
    .find(({ cell }) => cell.type === 'locked');
  const handlers = createEquipmentCommandHandlers({
    game: modeGame,
    drag: { mode: 'shovel' },
    gamePack: DEFAULT_GAME_PACK,
    invalid: (_command, reason) => ({ ok: false, reason }),
    clearDrag: () => {},
  });
  assert.equal(handlers['item.use']({
    type: 'item.use', tick: 4,
    payload: { itemId: 'shovel', target: { zone: 'grid', r: locked.r, c: locked.c } },
  }).ok, true);
  assert.equal(modeCollector.getEvents().find(({ eventId }) => eventId === 'deploy').source, 'shovel-mode');
}

{
  const leakCollector = createLocalEventCollector();
  const leakRuntime = createGameRuntime(DEFAULT_GAME_PACK, {
    eventSink: leakCollector,
    sessionId: 'double-leak-test',
    now: () => 1_000,
  });
  const leakGame = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, leakRuntime);
  leakGame.state.lives = 4;
  for (const [enemyId, enemyType, lane] of [
    ['enemy-1', 'normal', 0],
    ['enemy-2', 'fast', 1],
  ]) {
    leakRuntime.publishDomainEvent({
      type: 'combat.enemy_leaked', source: 'combat', tick: 5,
      payload: { enemyId, enemyType, wave: 1, lane },
    }, leakGame.state);
  }
  assert.equal(
    leakCollector.getEvents().filter(({ eventId }) => eventId === 'enemy_leak').length,
    0,
    '扣命前不得把 Combat 事实冒充为已结算 Telemetry',
  );
  leakRuntime.pumpDomainEvents(leakGame.state);
  assert.deepEqual(
    leakCollector.getEvents()
      .filter(({ eventId }) => eventId === 'enemy_leak')
      .map(({ livesBefore, livesRemaining }) => [livesBefore, livesRemaining]),
    [[4, 3], [3, 2]],
    '同 tick 漏怪应有递减的可审计生命账本',
  );
}

{
  const isolatedRuntime = createGameRuntime(DEFAULT_GAME_PACK, {
    events: { emit() { throw new Error('telemetry-down'); } },
  });
  const isolatedGame = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, isolatedRuntime);
  isolatedGame.startCurrentStage();
  assert.equal(isolatedRuntime.events.emit('session_start', isolatedGame.state, {}), false,
    '可替换 Telemetry reporter 抛错时必须降级为 false');
  assert.doesNotThrow(() => attemptRecruit(isolatedGame.state, () => 0),
    'Telemetry Adapter 抛错不得中断征兵规则');
  assert.equal(isolatedGame.state.recruitCount, 1);
}

const rejected = runtime.publishDomainEvent({
  type: 'command.rejected',
  source: 'foundation-runtime',
  tick: 0,
  payload: { commandType: 'unit.drop', reason: 'target-not-open' },
}, game.state);
assert.equal(rejected.sequence, 1);
assert.deepEqual(runtime.domainEvents.peek().map(({ type }) => type), ['command.rejected']);
assert.deepEqual(collector.getEvents().at(-1), {
  ...collector.getEvents().at(-1),
  eventId: 'invalid_action',
  result: 'failure',
  reason: 'target-not-open',
  actionId: 'unit.drop',
  domainTick: 0,
});

game.startCurrentStage();
const state = game.state;
assert.equal(collector.getEvents().at(-1).eventId, 'stage_start');

[[4, 4], [4, 5], [5, 4]].forEach(([r, c], index) => {
  state.grid[r][c].unit = state.bench[index];
  state.bench[index] = null;
});

const first = attemptRecruit(state, () => 0);
const second = attemptRecruit(state, () => 0);
assert.equal(first.ok && second.ok, true);
for (const [slot, cell] of [[first.slot, [4, 2]], [second.slot, [4, 3]]]) {
  state.grid[cell[0]][cell[1]].unit = state.bench[slot];
  state.bench[slot] = null;
}
const hero = detectHero(state.grid, 4, 3, DEFAULT_GAME_PACK);
unlockHero(state, hero, DEFAULT_GAME_PACK);
assert.equal(collector.getEvents().at(-1).eventId, 'hero_unlock');

state.enemies.push({ type: 'normal', wave: 1, lane: 0, hp: 100, maxHp: 100, p: 0, speed: 0, stun: 0, bob: 0 });
state.heroes[0].ultCd = 0;
updateHeroes(state, 0.01, cellXY);
assert.equal(collector.getEvents().at(-1).eventId, 'hero_cast');

state.enemies.length = 0;
state.phase = 'break';
state.phaseT = 0;
updateWaves(state, 0.01);
assert.equal(collector.getEvents().at(-1).eventId, 'wave_start');

state.enemies.length = 0;
state.spawnLeft = 0;
state.phase = 'wave';
const mantouBeforeWaveReward = state.mantou;
updateWaves(state, 0.01);
assert.equal(collector.getEvents().at(-1).eventId, 'wave_end');
assert.ok(state.mantou > mantouBeforeWaveReward);
assert.equal(collector.getEvents().at(-1).resourceSnapshot.mantou, state.mantou,
  'wave_end 必须在 Economy 奖励入账后采集资源快照');

state.over = false;
state.win = false;
state.enemies.push({ type: 'normal', wave: state.wave, lane: 0, hp: 1, maxHp: 1, p: state.path.length - 1, speed: 1, stun: 0, bob: 0 });
updateEnemies(state, 0.01, cellXY);
assert.equal(collector.getEvents().at(-1).eventId, 'enemy_leak');

Object.assign(state, { over: true, win: false, saved: true });
game.resolveResult();
assert.deepEqual(collector.getEvents().slice(-2).map(({ eventId }) => eventId), ['retry', 'stage_start']);

const events = collector.getEvents();
for (const event of events) {
  assert.equal(event.gameVersion, DEFAULT_GAME_PACK.versions.gameVersion);
  assert.equal(event.rulesetVersion, DEFAULT_GAME_PACK.versions.rulesetVersion);
  assert.equal(event.contentVersion, DEFAULT_GAME_PACK.versions.contentVersion);
  assert.equal(typeof event.reason, 'string');
}
assert.deepEqual(
  events.filter(({ eventId }) => eventId.startsWith('recruit_')).map(({ eventId }) => eventId),
  ['recruit_attempt', 'recruit_result', 'recruit_attempt', 'recruit_result'],
);

console.log('✓ 征兵、英雄、波次、漏怪与重试事件接入真实规则链');
