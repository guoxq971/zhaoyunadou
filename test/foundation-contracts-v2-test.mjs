import assert from 'node:assert/strict';
import {
  DOMAIN_EVENT_API_VERSION,
  DOMAIN_EVENT_PROTOCOL,
  PRESENTATION_CUE_API_VERSION,
  PRESENTATION_CUE_PROTOCOL,
  assertDomainEvent,
  commandRejectedDomainEvent,
  compareCodePointStrings,
  composeCommandHandlerMaps,
  createDomainEventQueue,
  createPresentationCueQueue,
  createSlicedState,
  getStateSlice,
} from '../src/engine-core/public.js';
import { applyStatModifiers } from '../src/systems/attribute/index.js';
import { createEventReporter as createLegacyReporter } from '../src/engine-core/events.js';
import {
  createTelemetryReporter,
  deriveTelemetryFromDomainEvent,
} from '../src/platform-services/public.js';

assert.deepEqual(
  ['a_b', 'a-b', 'a.b'].sort(compareCodePointStrings),
  ['a-b', 'a.b', 'a_b'],
  '稳定 ID 必须按代码点排序，不依赖 Host locale / ICU',
);

{
  const handlers = composeCommandHandlerMaps([
    { systemId: 'economy-formation', handlers: { 'battle.batch_recruit': () => ({ ok: true }) } },
    { systemId: 'board-route', handlers: { 'unit.drop': () => ({ ok: true }) } },
  ]);
  assert.deepEqual(Object.keys(handlers), ['battle.batch_recruit', 'unit.drop']);
  assert.equal(Object.isFrozen(handlers), true);
  assert.throws(() => composeCommandHandlerMaps([
    { systemId: 'one', handlers: { 'unit.drop': () => ({ ok: true }) } },
    { systemId: 'two', handlers: { 'unit.drop': () => ({ ok: true }) } },
  ]), /duplicate command type.*unit\.drop.*one.*two/i);
}

{
  const cues = createPresentationCueQueue({ limit: 1 });
  const cue = cues.publish({
    type: 'skill.cast_feedback', source: 'skill-status', tick: 9,
    payload: { skillId: 'dragon' },
  });
  assert.equal(cue.apiVersion, PRESENTATION_CUE_API_VERSION);
  assert.equal(cue.protocol, PRESENTATION_CUE_PROTOCOL);
  assert.equal(cue.type, 'skill.cast_feedback');
  assert.equal(cues.peek().length, 1);
  assert.throws(() => assertDomainEvent(cue), /protocol/i, '表现 Cue 不能冒充 DomainEvent');
}

{
  const initial = { time: 0, mantou: 40, wave: 0, damage: 10, stats: { recruits: 0, kills: 0 } };
  const state = createSlicedState(initial, {
    foundation: ['time'],
    economy: ['mantou'],
    encounter: ['wave'],
    combat: ['damage'],
  }, {
    facades: { stats: { recruits: 'economy', kills: 'combat' } },
  });
  assert.deepEqual(Object.keys(state), Object.keys(initial), '兼容门面的顶层字段顺序与形状必须保持');
  assert.equal(Object.keys(state).includes('slices'), false, '系统切片不能进入旧存档 JSON');
  assert.deepEqual(JSON.parse(JSON.stringify(state)), initial);
  state.mantou -= 16;
  assert.equal(getStateSlice(state, 'economy').mantou, 24);
  getStateSlice(state, 'encounter').wave = 1;
  assert.equal(state.wave, 1, '切片与旧顶层兼容访问必须引用同一份状态');
  state.stats.recruits++;
  assert.equal(getStateSlice(state, 'economy').stats.recruits, 1, '共享统计门面必须写入真实 owner 切片');
  assert.throws(() => createSlicedState({ shared: 1 }, {
    board: ['shared'], economy: ['shared'],
  }), /duplicate state key.*shared/i);
  assert.throws(() => getStateSlice(state, 'presentation'), /unknown state slice.*presentation/i);
}

{
  assert.deepEqual(commandRejectedDomainEvent({
    tick: 5,
    commandType: 'unit.drop',
    reason: 'target-not-open',
  }), {
    type: 'command.rejected',
    source: 'foundation-runtime',
    tick: 5,
    payload: { commandType: 'unit.drop', reason: 'target-not-open' },
  });

  const queue = createDomainEventQueue({ limit: 2 });
  const first = queue.publish({
    type: 'economy.recruit_completed', source: 'economy-formation', tick: 7,
    payload: { count: 2, cost: 36 },
  });
  assert.deepEqual(first, {
    apiVersion: DOMAIN_EVENT_API_VERSION,
    protocol: DOMAIN_EVENT_PROTOCOL,
    type: 'economy.recruit_completed',
    source: 'economy-formation',
    sequence: 1,
    tick: 7,
    payload: { count: 2, cost: 36 },
  });
  assert.equal(Object.isFrozen(first.payload), true);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.throws(() => assertDomainEvent({ ...first, hostObject: new Date() }),
    /unexpected field|plain data|serializable/,
    'DomainEvent envelope 不得夹带平台对象或未声明字段');
  const hiddenEvent = { ...first };
  Object.defineProperty(hiddenEvent, 'hostObject', {
    value: new Date(),
    enumerable: false,
  });
  assert.throws(() => assertDomainEvent(hiddenEvent), /unexpected field|plain data|serializable/,
    '不可枚举字段不能绕过 DomainEvent envelope 校验');
  const symbolEvent = { ...first, [Symbol('host-object')]: new Date() };
  assert.throws(() => assertDomainEvent(symbolEvent), /unexpected field|plain data|serializable/,
    'Symbol 字段不能绕过 DomainEvent envelope 校验');
  queue.publish({ type: 'board.piece_moved', source: 'board-route', tick: 7, payload: {} });
  queue.publish({ type: 'encounter.wave_started', source: 'stage-encounter', tick: 8, payload: { wave: 1 } });
  assert.equal(queue.dropped, 1);
  assert.deepEqual(queue.peek().map(({ sequence }) => sequence), [2, 3]);
  const drained = queue.drain();
  assert.deepEqual(drained.map(({ type }) => type), ['board.piece_moved', 'encounter.wave_started']);
  assert.equal(queue.size, 0);
  assert.throws(() => queue.publish({
    type: 'bad event', source: 'board-route', tick: 9, payload: {},
  }), /type must be a stable id/i);
  assert.throws(() => queue.publish({
    type: 'board.piece_moved', source: 'board-route', tick: 9, payload: { node: () => {} },
  }), /serializable/i);
}

{
  const result = applyStatModifiers(10, [
    { id: 'aura', stat: 'damage', operation: 'multiply', value: 1.5, priority: 20 },
    { id: 'equipment', stat: 'damage', operation: 'add', value: 2, priority: 10 },
    { id: 'status', stat: 'damage', operation: 'add', value: 3, priority: 10 },
  ], 'damage');
  assert.equal(result, 22.5, '同 priority 按稳定 ID 排序，先加算再乘算');
  const reversed = applyStatModifiers(10, [
    { id: 'status', stat: 'damage', operation: 'add', value: 3, priority: 10 },
    { id: 'aura', stat: 'damage', operation: 'multiply', value: 1.5, priority: 20 },
    { id: 'equipment', stat: 'damage', operation: 'add', value: 2, priority: 10 },
  ], 'damage');
  assert.equal(reversed, result, '输入顺序不得改变属性结果');
}

{
  assert.equal(createLegacyReporter, createTelemetryReporter, '旧 events 入口必须是 Telemetry 兼容门面');
  assert.deepEqual(deriveTelemetryFromDomainEvent({
    type: 'command.rejected', tick: 5,
    payload: { commandType: 'unit.drop', reason: 'target-not-open' },
  }), {
    eventId: 'invalid_action',
    details: { result: 'failure', reason: 'target-not-open', actionId: 'unit.drop', domainTick: 5 },
  });
  assert.equal(deriveTelemetryFromDomainEvent({ type: 'unknown.fact', tick: 1, payload: {} }), null);
}

console.log('✓ GameCommand 组合、DomainEvent、Telemetry、状态切片与 Modifier 契约');
