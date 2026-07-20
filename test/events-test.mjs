import assert from 'node:assert/strict';
import {
  REQUIRED_EVENT_IDS,
  createEventReporter,
  validateEventManifest,
} from '../src/engine-core/events.js';
import { createLocalEventCollector } from '../src/platform-services/local-event-collector.js';
import { snapshotMergeDefenseState } from '../src/rulesets/merge-defense/event-snapshot.js';

const manifest = {
  schemaVersion: 1,
  version: '1.0.0',
  events: REQUIRED_EVENT_IDS.map((id) => ({ id, requiredFields: [], privacy: 'anonymous' })),
};

{
  const definitions = validateEventManifest(manifest);
  assert.deepEqual(Object.keys(definitions), REQUIRED_EVENT_IDS);
  assert.equal(definitions.stage_start.version, '1.0.0', '事件项应继承 Manifest 版本');
  assert.throws(
    () => validateEventManifest({ events: [{ id: 'session_start', version: 1 }] }),
    /missing required event "session_end"/,
  );
  assert.throws(
    () => validateEventManifest({ events: [
      { id: 'same_event', version: 1 },
      { id: 'same_event', version: 1 },
    ] }, { requiredEventIds: [] }),
    /duplicate event id "same_event"/,
  );
  assert.throws(
    () => validateEventManifest([{ id: 'Bad-Event', version: 1 }], { requiredEventIds: [] }),
    /must match/,
  );
  assert.throws(
    () => validateEventManifest([{ id: 'valid_event' }], { requiredEventIds: [] }),
    /version is required/,
  );
  assert.throws(
    () => validateEventManifest({ version: 1, events: [{ id: 'valid_event', requiredFields: ['cost', 'cost'] }] }, { requiredEventIds: [] }),
    /requiredFields contains duplicates/,
  );
  assert.throws(
    () => validateEventManifest({
      version: 1,
      requiredCommonFields: ['reason', 'reason'],
      events: [{ id: 'valid_event' }],
    }, { requiredEventIds: [] }),
    /requiredCommonFields contains duplicates/,
  );
}

{
  const reporter = createEventReporter({
    manifest: {
      version: '1.0.0',
      requiredCommonFields: ['gameVersion', 'rulesetVersion', 'contentVersion', 'result', 'reason'],
      events: [{ id: 'merge', requiredFields: ['unitId', 'level'] }],
    },
    versions: { gameVersion: '1', rulesetVersion: '1', contentVersion: '1' },
    sessionId: 'strict-fields',
    now: () => 0,
    requiredEventIds: [],
  });
  assert.throws(
    () => reporter.emit('merge', null, { result: 'success', reason: 'none', unitId: 'dao' }),
    /missing required fields: level/,
  );
  assert.throws(
    () => reporter.emit('merge', null, { result: 'failure', unitId: 'dao', level: 1 }),
    /failure reason is required/,
  );
  assert.equal(reporter.emit('merge', null, {
    result: 'success', reason: 'none', unitId: 'dao', level: 2,
  }), true);
}

{
  let now = 1_000;
  const collector = createLocalEventCollector();
  const reporter = createEventReporter({
    manifest,
    versions: {
      gameVersion: '1.2.3',
      rulesetVersion: '1.0.0',
      contentVersion: '2026.07.20',
    },
    sink: collector,
    sessionId: 'test-session',
    now: () => now,
    snapshotState: snapshotMergeDefenseState,
  });
  const state = {
    title: false,
    over: false,
    win: false,
    stageIndex: 1,
    stage: { id: 'star-2' },
    wave: 3,
    time: 12,
    phase: 'wave',
    mantou: 24,
    lives: 5,
    shovels: 1,
    brushes: 0,
    bench: [{ kind: 'troop' }, null, { kind: 'frag' }],
    stats: { recruits: 2, merges: 1 },
  };

  now = 2_500;
  assert.equal(reporter.emit('stage_start', state, {
    result: 'started',
    reason: 'player-start',
    source: 'title',
    // 保留字段不允许调用方覆盖。
    gameVersion: 'forged',
  }), true);

  const [event] = collector.getEvents();
  assert.deepEqual({
    eventId: event.eventId,
    eventVersion: event.eventVersion,
    gameVersion: event.gameVersion,
    rulesetVersion: event.rulesetVersion,
    contentVersion: event.contentVersion,
    sessionId: event.sessionId,
    stage: event.stage,
    stageIndex: event.stageIndex,
    wave: event.wave,
    sessionTime: event.sessionTime,
    result: event.result,
    reason: event.reason,
    source: event.source,
  }, {
    eventId: 'stage_start',
    eventVersion: '1.0.0',
    gameVersion: '1.2.3',
    rulesetVersion: '1.0.0',
    contentVersion: '2026.07.20',
    sessionId: 'test-session',
    stage: 'star-2',
    stageIndex: 1,
    wave: 3,
    sessionTime: 1.5,
    result: 'started',
    reason: 'player-start',
    source: 'title',
  });
  assert.deepEqual(event.resourceSnapshot, {
    mantou: 24,
    lives: 5,
    shovels: 1,
    brushes: 0,
    benchUsed: 2,
    benchCapacity: 3,
  });

  // 原 state 与读取结果都不能反向篡改已采集快照。
  state.mantou = 999;
  state.stats.recruits = 99;
  assert.equal(collector.getEvents()[0].resourceSnapshot.mantou, 24);
  assert.equal(collector.getEvents()[0].stateSnapshot.stats.recruits, 2);
  assert.throws(() => { event.resourceSnapshot.mantou = 88; }, TypeError);
  assert.throws(() => { collector.getEvents().push({}); }, TypeError);
  assert.equal(collector.getEvents()[0].resourceSnapshot.mantou, 24);

  now = 3_000;
  reporter.emit('merge', state);
  const defaulted = collector.getEvents()[1];
  assert.equal(defaulted.result, 'success');
  assert.equal(defaulted.reason, 'none');
  assert.equal(defaulted.resourceSnapshot.mantou, 999);
  assert.throws(() => reporter.emit('not_registered', state), /unknown event/);
}

{
  let reportedError = null;
  const reporter = createEventReporter({
    manifest,
    versions: { gameVersion: 1, rulesetVersion: 1, contentVersion: 1 },
    sessionId: 'fault-isolation',
    now: () => 0,
    sink: { emit() { throw new Error('offline'); } },
    onSinkError(error) { reportedError = error; },
  });
  const gameplay = { counter: 0 };
  gameplay.counter++;
  assert.equal(reporter.emit('deploy', { wave: 1 }, { result: 'success' }), false);
  gameplay.counter++;
  assert.equal(gameplay.counter, 2, '采集器故障不得中断玩法调用链');
  assert.match(reportedError.message, /offline/);
}

{
  const received = [];
  const reporter = createEventReporter({
    manifest,
    versions: { gameVersion: '1', rulesetVersion: '1', contentVersion: '1' },
    sessionId: 'collector-alias',
    now: () => 0,
    sink: { collect(event) { received.push(event); } },
  });
  assert.equal(reporter.emit('session_start'), true);
  assert.equal(received[0].eventId, 'session_start');
}

{
  const collector = createLocalEventCollector({ limit: 2 });
  collector.emit({ eventId: 'one', nested: { value: 1 } });
  collector.emit({ eventId: 'two' });
  collector.emit({ eventId: 'three' });
  assert.equal(collector.size, 2);
  assert.equal(collector.dropped, 1);
  assert.deepEqual(collector.getEvents().map(({ eventId }) => eventId), ['two', 'three']);
  collector.clear();
  assert.equal(collector.size, 0);
  assert.equal(collector.dropped, 0);
}

console.log('✓ 事件定义、版本快照、本地采集与故障隔离');
