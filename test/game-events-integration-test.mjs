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

const collector = createLocalEventCollector();
const runtime = createGameRuntime(DEFAULT_GAME_PACK, {
  eventSink: collector,
  sessionId: 'integration-test',
  now: () => 1_000,
});
const game = createGameController(0, () => {}, () => true, DEFAULT_GAME_PACK, runtime);

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
updateWaves(state, 0.01);
assert.equal(collector.getEvents().at(-1).eventId, 'wave_end');

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
