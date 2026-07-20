import assert from 'node:assert/strict';
import {
  createCommandDispatcher,
  createCommandFactory,
  getStateSlice,
  setSimulationPaused,
  setSimulationSpeed,
} from '../src/engine-core/public.js';
import { createGame } from '../src/state.js';

{
  const state = { value: 0 };
  const rejections = [];
  const dispatcher = createCommandDispatcher({
    handlers: {
      'counter.add'(command) {
        state.value += command.payload.amount;
        return { ok: true, reason: 'none', value: state.value };
      },
    },
    getStateSummary: () => state,
    authorize(command) {
      if (command.actorId !== 'local-player') return { ok: false, reason: 'actor-not-registered' };
      if (command.side !== 'player') return { ok: false, reason: 'actor-side-mismatch' };
      return { ok: true, reason: 'none' };
    },
    onRejected(command, result) {
      rejections.push({ sequence: command.sequence, reason: result.reason });
    },
  });
  const factory = createCommandFactory({ actorId: 'local-player', side: 'player' });
  const first = factory.create('counter.add', { amount: 2 });

  assert.deepEqual(dispatcher.dispatch({ ...first, side: 'opponent' }), {
    ok: false,
    reason: 'actor-side-mismatch',
  });
  assert.equal(state.value, 0, '授权失败不得执行 handler');
  assert.equal(
    dispatcher.dispatch(first).value,
    2,
    '授权失败不得吞掉同 actor 的合法 sequence',
  );
  assert.deepEqual(rejections, [{ sequence: 1, reason: 'actor-side-mismatch' }]);
}

{
  const state = { value: 0 };
  const dispatcher = createCommandDispatcher({
    handlers: {
      'counter.add'(command) {
        state.value += command.payload.amount;
        return { ok: true, reason: 'none', value: state.value };
      },
    },
    getStateSummary: () => state,
  });
  const factory = createCommandFactory({ actorId: 'any-controller', side: 'any-side' });
  assert.equal(
    dispatcher.dispatch(factory.create('counter.add', { amount: 3 })).value,
    3,
    '未提供 authorize 时必须完全兼容旧分发行为',
  );
}

{
  const state = createGame();
  const foundation = getStateSlice(state, 'foundation');
  assert.equal(foundation.resumeSpeed, 1, 'resumeSpeed 必须由 foundation slice 拥有');

  assert.deepEqual(setSimulationSpeed(state, 2), { speed: 2, resumeSpeed: 2 });
  assert.equal(state.speed, 2);
  assert.equal(state.resumeSpeed, 2);
  assert.deepEqual(setSimulationPaused(state, true), {
    paused: true,
    speed: 0,
    resumeSpeed: 2,
  });
  assert.deepEqual(setSimulationPaused(state, false), {
    paused: false,
    speed: 2,
    resumeSpeed: 2,
  });
  assert.equal(getStateSlice(state, 'foundation').speed, 2);
  assert.equal(getStateSlice(state, 'foundation').resumeSpeed, 2);
  assert.throws(() => setSimulationSpeed(state, -1), /speed/i);
}

console.log('✓ MatchMode 授权不消费序号且 foundation 独占暂停速度状态');
