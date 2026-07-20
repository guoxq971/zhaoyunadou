import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  BEST_WAVE_STORAGE_KEY,
  CAMPAIGN_STORAGE_KEY,
  clearProgress,
  loadProgress,
  normalizeClearedStars,
  progressAfterResult,
  resultAction,
  settleResult,
  stageIndexForProgress,
} from '../src/campaign.js';
import { createGame } from '../src/state.js';
import { advanceBattle } from '../src/game-loop.js';
import { updateWaves } from '../src/enemies.js';
import { cellXY } from '../src/ui-layout.js';
import { attemptRecruit } from '../src/actions.js';
import { detectHero, unlockHero } from '../src/logic.js';

class MemoryStorage {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed));
    this.writes = 0;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
    this.writes++;
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function deployStarterBench(state) {
  const cells = [[4, 4], [4, 5], [5, 4]];
  cells.forEach(([r, c], index) => {
    state.grid[r][c].unit = state.bench[index];
    state.bench[index] = null;
  });
}

function finishStage(state) {
  deployStarterBench(state);
  // 逐次真实征兵、腾营位、落双字并合成该关代表英雄。
  const heroCells = [[4, 2], [4, 3]];
  heroCells.forEach(([r, c]) => {
    const recruit = attemptRecruit(state, () => 0);
    assert.equal(recruit.ok, true);
    state.grid[r][c].unit = state.bench[recruit.slot];
    state.bench[recruit.slot] = null;
  });
  const hero = detectHero(state.grid, 4, 3);
  assert.equal(hero?.key, state.stage.featuredHero);
  unlockHero(state, hero);
  state.title = false;
  state.phaseT = 0;
  for (let elapsed = 0; elapsed < 300 && !state.over; elapsed += 0.025) {
    advanceBattle(state, 0.025, cellXY);
    if (state.phase === 'break' && state.phaseT !== null) state.phaseT = 0;
  }
}

assert.equal(CONFIG.campaign.stages.length, 5, '军士一应有 5 个星级关卡');
assert.deepEqual(CONFIG.campaign.stages.map((stage) => stage.star), [1, 2, 3, 4, 5]);
assert.equal(new Set(CONFIG.campaign.stages.map((stage) => stage.id)).size, 5, '关卡 id 不可重复');
assert.equal(new Set(CONFIG.campaign.stages.map((stage) => stage.name)).size, 5, '五关应有不同战役名');
assert.ok(CONFIG.campaign.stages.every((stage) => stage.waveCount > 0));

for (const [raw, expected] of [[null, 0], ['', 0], ['abc', 0], [-3, 0], [2.8, 2], [99, 5]]) {
  assert.equal(normalizeClearedStars(raw), expected, `坏存档 ${String(raw)} 应归一化为 ${expected}`);
}
assert.equal(loadProgress(new MemoryStorage()), 0);
assert.deepEqual([0, 1, 2, 3, 4, 5].map(stageIndexForProgress), [0, 1, 2, 3, 4, 4]);

assert.equal(loadProgress({ getItem() { throw new Error('blocked'); } }), 0, '读取存档异常时从 0 星启动');

{
  const storage = new MemoryStorage({
    [CAMPAIGN_STORAGE_KEY]: '5',
    [BEST_WAVE_STORAGE_KEY]: '12',
  });
  assert.equal(clearProgress(storage), true);
  assert.equal(storage.getItem(CAMPAIGN_STORAGE_KEY), null);
  assert.equal(storage.getItem(BEST_WAVE_STORAGE_KEY), null);
}

{
  const state = createGame(0, 0);
  Object.assign(state, { over: true, win: true });
  const result = settleResult(state, {
    getItem() { return null; },
    setItem() { throw new Error('quota'); },
  });
  assert.equal(result, 1, '持久化失败时仍允许当前会话继续');
  assert.equal(state.saved, true);
  assert.equal(state.saveWarning, true);
  assert.equal(resultAction(state).kind, 'next');
}

let progress = 0;
assert.equal(progressAfterResult(progress, 2, true), 0, '不可越过未解锁关卡');
assert.equal(progressAfterResult(progress, 0, false), 0, '失败不解锁星级');
for (let stageIndex = 0; stageIndex < 5; stageIndex++) {
  progress = progressAfterResult(progress, stageIndex, true);
  assert.equal(progress, stageIndex + 1);
}
assert.equal(progressAfterResult(progress, 0, true), 5, '重打旧关不可让进度倒退');

for (let stageIndex = 0; stageIndex < 5; stageIndex++) {
  const state = createGame(stageIndex, stageIndex);
  assert.equal(state.stageIndex, stageIndex);
  assert.equal(state.waveTarget, CONFIG.campaign.stages[stageIndex].waveCount);
  assert.equal(state.phaseT, null, `第 ${stageIndex + 1} 关首波应等待玩家`);
  advanceBattle(state, 30, cellXY);
  assert.equal(state.wave, 0, `第 ${stageIndex + 1} 关不可自动开首波`);
}
assert.equal(createGame(-1).stageIndex, 0);
assert.equal(createGame(99).stageIndex, 4);

{
  const storage = new MemoryStorage();
  const running = createGame(0, 0);
  assert.equal(settleResult(running, storage), 0, '进行中不可误结算');
  assert.equal(running.saved, undefined);
  assert.equal(storage.writes, 0);

  const state = createGame(0, 0);
  Object.assign(state, { over: true, win: true });
  assert.equal(settleResult(state, storage), 1);
  assert.equal(settleResult(state, storage), 1, '同一结算不可重复写存档');
  assert.equal(storage.writes, 1);
  assert.equal(resultAction(state).kind, 'next');
  assert.equal(resultAction(state).stageIndex, 1);
}

{
  const storage = new MemoryStorage();
  const defeat = createGame(0, 0);
  Object.assign(defeat, { over: true, win: false });
  assert.equal(settleResult(defeat, storage), 0);
  assert.equal(storage.writes, 0, '败北不可写入新星级');
  assert.deepEqual(resultAction(defeat), { kind: 'replay', stageIndex: 0 });

  const locked = createGame(2, 5);
  Object.assign(locked, { over: true, win: true });
  assert.equal(settleResult(locked, storage), 0, '内存进度不可越过持久化解锁状态');
  assert.deepEqual(resultAction(locked), { kind: 'replay', stageIndex: 2 });
}

for (let stageIndex = 0; stageIndex < 5; stageIndex++) {
  const state = createGame(stageIndex, stageIndex);
  state.wave = state.waveTarget;
  state.phase = 'wave';
  state.spawnTotal = 1;
  state.spawnLeft = 1;
  state.spawnT = 0;
  updateWaves(state, 0.1);
  const expected = stageIndex === 4 ? 'boss' : 'elite';
  assert.equal(state.enemies[0]?.type, expected, `第 ${stageIndex + 1} 关关底敌人应为 ${expected}`);
}

{
  const storage = new MemoryStorage();
  for (let stageIndex = 0; stageIndex < 5; stageIndex++) {
    const clearedStars = loadProgress(storage);
    const state = createGame(stageIndex, clearedStars);
    finishStage(state);
    assert.equal(state.over, true);
    assert.equal(state.win, true, `起始编队应通过第 ${stageIndex + 1} 关`);
    assert.equal(state.wave, state.waveTarget);
    assert.ok(state.lives > 0, `第 ${stageIndex + 1} 关结算时阿斗必须存活`);
    assert.equal(state.lastHeroUnlocked, state.stage.featuredHero);
    assert.ok(state.stats.heroCasts > 0, `第 ${stageIndex + 1} 关代表英雄必须真实释放过技能`);
    assert.equal(settleResult(state, storage), stageIndex + 1);

    const action = resultAction(state);
    assert.equal(action.kind, stageIndex < 4 ? 'next' : 'complete');
    assert.equal(action.stageIndex, Math.min(stageIndex + 1, 4));
  }
  assert.equal(loadProgress(storage), 5);
  assert.equal(storage.writes, 5);
}

console.log('✓ 军士一五星配置与存档边界');
console.log('✓ 每关首波主动开战与关底敌人');
console.log('✓ 起始编队完整通过前 5 关');
