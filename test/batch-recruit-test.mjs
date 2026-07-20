import assert from 'node:assert/strict';
import { attemptBatchRecruit, attemptRecruit } from '../src/actions.js';
import { createGame } from '../src/state.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGameRuntime } from '../src/runtime.js';
import { createLocalEventCollector } from '../src/platform-services/local-event-collector.js';
import { createLocalCommandFeedback } from '../src/presentation-pack/local-command-feedback.js';
import { updateEffects } from '../src/effects.js';

{
  const state = createGame();
  const result = attemptBatchRecruit(state, () => 0);
  assert.deepEqual({
    ok: result.ok,
    filledCount: result.filledCount,
    totalCost: result.totalCost,
    stopReason: result.stopReason,
    nextCost: result.nextCost,
  }, {
    ok: true,
    filledCount: 1,
    totalCost: 16,
    stopReason: 'bench-full',
    nextCost: 20,
  });
  assert.equal(state.mantou, 24);
  assert.equal(state.recruitCount, 1);
  assert.equal(state.stats.recruits, 1);
}

{
  const collector = createLocalEventCollector();
  const runtime = createGameRuntime(DEFAULT_GAME_PACK, { eventSink: collector, now: () => 0 });
  const state = createGame(0, 0, DEFAULT_GAME_PACK, runtime);
  state.bench.fill(null);
  state.mantou = 40;
  const result = attemptBatchRecruit(state, () => 0);
  assert.equal(result.filledCount, 2);
  assert.deepEqual(
    collector.getEvents().filter(({ eventId }) => eventId.startsWith('recruit_')).map(({ eventId }) => eventId),
    ['recruit_attempt', 'recruit_result', 'recruit_attempt', 'recruit_result'],
    '每次真实抽取必须各有一对 attempt/result，停止时不得伪造额外抽取',
  );
  assert.equal(collector.getEvents().some(({ eventId }) => eventId === 'invalid_action'), false, '部分成功是合法结果');
}

{
  const state = createGame();
  state.bench.fill(null);
  state.mantou = 40;
  const result = attemptBatchRecruit(state, () => 0);
  assert.equal(result.filledCount, 2);
  assert.equal(result.totalCost, 36);
  assert.equal(result.stopReason, 'insufficient-mantou');
  assert.equal(state.mantou, 4);
  assert.deepEqual(state.bench.slice(0, 2).map(({ char }) => char), ['赵', '云'], '双字保底语义不得改变');
}

{
  const state = createGame();
  state.bench.fill(null);
  state.recruitQueue = [];
  state.mantou = 150;
  let randomCalls = 0;
  const result = attemptBatchRecruit(state, () => { randomCalls++; return 0; });
  assert.equal(result.filledCount, 5);
  assert.equal(result.totalCost, 140);
  assert.equal(result.stopReason, 'bench-full');
  assert.equal(state.mantou, 10);
  assert.equal(randomCalls, 5);
}

{
  const state = createGame();
  state.bench = state.bench.map((item) => item ?? { kind: 'troop', type: 'qi', level: 1 });
  state.mantou = 0;
  const before = JSON.stringify(state);
  let randomCalls = 0;
  const result = attemptBatchRecruit(state, () => { randomCalls++; return 0; });
  assert.deepEqual({
    ok: result.ok,
    reason: result.reason,
    filledCount: result.filledCount,
    totalCost: result.totalCost,
  }, { ok: false, reason: 'bench-full', filledCount: 0, totalCost: 0 });
  assert.equal(randomCalls, 0);
  assert.equal(JSON.stringify(state), before, '营满不得扣费、抽随机或覆盖已有候选');
}

{
  const batch = createGame();
  const singles = createGame();
  batch.bench.fill(null);
  singles.bench.fill(null);
  batch.recruitQueue = [];
  singles.recruitQueue = [];
  batch.mantou = singles.mantou = 100;
  const sequenceA = [0.01, 0.37, 0.82, 0.55];
  const sequenceB = [...sequenceA];
  const batchResult = attemptBatchRecruit(batch, () => sequenceA.shift());
  for (let index = 0; index < batchResult.filledCount; index++) attemptRecruit(singles, () => sequenceB.shift());
  assert.deepEqual({
    bench: batch.bench,
    mantou: batch.mantou,
    recruitCount: batch.recruitCount,
    stats: batch.stats,
  }, {
    bench: singles.bench,
    mantou: singles.mantou,
    recruitCount: singles.recruitCount,
    stats: singles.stats,
  }, '批量征兵必须等价于相同次数的现有单抽');
}

{
  const state = createGame();
  state.bench.fill(null);
  state.recruitQueue = [];
  state.mantou = 150;
  const result = attemptBatchRecruit(state, () => 0);
  const present = createLocalCommandFeedback({
    game: { state }, drag: {}, gamePack: DEFAULT_GAME_PACK, audioEngine: null,
  });
  present({ type: 'battle.batch_recruit', sequence: 1 }, result);
  const seals = state.effects.filter(({ feedbackId }) => feedbackId === 'recruit-seal');
  assert.equal(seals.length, 5, '每个新候选槽必须生成独立盖印反馈');
  assert.deepEqual(seals.map(({ t }) => Number(t.toFixed(2))), [0, -0.08, -0.16, -0.24, -0.32],
    '批量征兵反馈必须按表现令牌依次弹入');
  const delayedMark = state.effects.find(({ feedbackId, t }) => feedbackId === 'recruit-mark' && t === -0.32);
  const initialY = delayedMark.y;
  updateEffects(state, 0.08);
  assert.equal(delayedMark.y, initialY, '尚未出现的延迟盖印不得提前漂移');
  assert.equal(Number(delayedMark.t.toFixed(2)), -0.24);
}

console.log('✓ 批量征兵填满、部分成功、营满零扣费与单抽等价');
