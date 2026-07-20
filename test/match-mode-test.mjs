import assert from 'node:assert/strict';
import * as matchModePublic from '../src/systems/match-mode/index.js';

const {
  FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES,
  FIXED_ROUTE_CAMPAIGN_MODE_ID,
  FIXED_ROUTE_MATCH_COMMAND_TYPES,
  MATCH_MODE_API_VERSION,
  assertMatchModeContract,
  authorizeFixedRouteCampaignCommand,
  consumeFixedRouteCampaignDomainEvents,
  createFixedRouteCampaignCommandHandlers,
  createFixedRouteCampaignDomainEventHandlers,
  createFixedRouteCampaignMode,
} = matchModePublic;

const gamePack = Object.freeze({
  config: Object.freeze({
    campaign: Object.freeze({
      stages: Object.freeze(Array.from({ length: 5 }, (_, index) => Object.freeze({
        id: `stage-${index + 1}`,
        name: `第 ${index + 1} 关`,
      }))),
    }),
  }),
});

function fakeState(stageIndex, clearedStars) {
  return {
    title: true,
    time: 0,
    resetConfirmUntil: 0,
    resetResult: 'idle',
    speed: 1,
    resumeSpeed: 1,
    stageIndex,
    stage: gamePack.config.campaign.stages[stageIndex],
    clearedStars,
    over: false,
    win: false,
    saved: undefined,
  };
}

function createHarness(initialProgress = 0, overrides = {}) {
  const trace = [];
  const events = [];
  let clearResult = true;
  const mode = createFixedRouteCampaignMode({
    initialProgress,
    gamePack,
    createState(stageIndex, clearedStars, receivedPack) {
      assert.equal(receivedPack, gamePack);
      trace.push(`create:${stageIndex}:${clearedStars}`);
      return fakeState(stageIndex, clearedStars);
    },
    advanceRules(state, dt, context) {
      trace.push(`advance:${state.stageIndex}:${dt}:${context?.label ?? 'none'}`);
      state.time += dt;
      return { advanced: dt };
    },
    onInteractionReset() { trace.push('interaction-reset'); },
    clearProgress() {
      trace.push('clear-progress');
      return clearResult;
    },
    publishDomainEvent(state, definition) {
      events.push({ state, definition: structuredClone(definition) });
      return definition;
    },
    getTick: () => 17,
    ...overrides,
  });
  return {
    mode,
    trace,
    events,
    setClearResult(value) { clearResult = value; },
  };
}

function command(type, payload = {}, actorId = 'local-player', side = 'player') {
  return {
    apiVersion: '1.0.0', type, actorId, side,
    sequence: 1, tick: 9, time: 0, payload,
  };
}

assert.equal(MATCH_MODE_API_VERSION, '1.0.0');
assert.equal(FIXED_ROUTE_CAMPAIGN_MODE_ID, 'fixed-route-campaign');
assert.equal(FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES.length, 16);
assert.equal(new Set(FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES).size, 16);
assert.deepEqual(FIXED_ROUTE_MATCH_COMMAND_TYPES, [
  'campaign.select_stage',
  'campaign.start_stage',
  'campaign.reset_progress',
  'battle.set_paused',
  'battle.set_speed',
  'battle.retry',
  'result.resolve',
  'session.quit',
]);

for (const type of FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES) {
  assert.deepEqual(authorizeFixedRouteCampaignCommand(command(type)), { ok: true, reason: 'none' });
}
assert.deepEqual(
  authorizeFixedRouteCampaignCommand(command('battle.start_wave', {}, 'intruder', 'player')),
  { ok: false, reason: 'actor-not-registered' },
);
assert.deepEqual(
  authorizeFixedRouteCampaignCommand(command('battle.start_wave', {}, 'local-player', 'enemy')),
  { ok: false, reason: 'actor-side-mismatch' },
);
assert.deepEqual(
  authorizeFixedRouteCampaignCommand(command('network.connect')),
  { ok: false, reason: 'command-not-authorized' },
);

{
  const { mode, trace, events } = createHarness(2);
  assert.equal(assertMatchModeContract(mode), mode);
  assert.equal(mode.matchModeApiVersion, MATCH_MODE_API_VERSION);
  assert.equal(mode.modeId, FIXED_ROUTE_CAMPAIGN_MODE_ID);
  assert.deepEqual(mode.actor, { actorId: 'local-player', side: 'player' });
  assert.deepEqual(mode.actors, [{ actorId: 'local-player', side: 'player' }]);
  assert.equal(mode.state.stageIndex, 0, '刷新仍应从第一关标题页开始');
  assert.equal(mode.highestUnlockedStageIndex, 2);
  assert.deepEqual(mode.advance(0.25, { label: 'title' }), {
    advanced: false, reason: 'title-time',
  });
  assert.equal(mode.state.time, 0.25);
  assert.equal(trace.some((entry) => entry.includes('advance:')), false,
    '标题页不得误推进固定路线规则');
  assert.equal(mode.selectStage(2), true);
  assert.equal(mode.state.stageIndex, 2);
  assert.equal(mode.selectStage(4), false, '不可选择未解锁关卡');

  mode.startCurrentStage();
  assert.equal(mode.state.title, false);
  assert.equal(events.at(-1).definition.type, 'match.started');
  assert.equal(events.at(-1).definition.tick, 17);
  assert.deepEqual(mode.advance(0.25, { label: 'tick' }), { advanced: 0.25 });
  assert.equal(mode.state.time, 0.25);
  assert.equal(mode.abandon('host-destroy'), true);
  assert.equal(mode.state.title, false, 'Host 销毁只结束对局，不应重建标题状态');
  assert.deepEqual(events.slice(-2).map(({ definition }) => definition.type), [
    'match.quit_requested', 'match.ended',
  ]);
  mode.startStage(2);
  assert.equal(mode.quitToTitle(), true);
  assert.equal(mode.state.title, true);
  assert.deepEqual(events.slice(-2).map(({ definition }) => definition.type), [
    'match.quit_requested', 'match.ended',
  ]);
  assert.equal(events.at(-1).definition.payload.result, 'abandoned');
  assert.equal(mode.quitToTitle(), false, '标题页不能重复退出');
  assert.ok(trace.filter((entry) => entry === 'interaction-reset').length >= 3);
}

{
  const harness = createHarness(4);
  const { mode, trace } = harness;
  mode.state.time = 7;
  assert.equal(mode.requestProgressReset(), 'confirm');
  assert.equal(mode.state.clearedStars, 4);
  assert.equal(mode.state.resetConfirmUntil, 10);
  assert.equal(mode.requestProgressReset(), 'cleared');
  assert.equal(trace.filter((entry) => entry === 'clear-progress').length, 1);
  assert.equal(mode.state.stageIndex, 0);
  assert.equal(mode.state.clearedStars, 0);
  assert.equal(mode.state.resetResult, 'cleared');

  const failed = createHarness(3);
  failed.setClearResult(false);
  failed.mode.state.time = 2;
  assert.equal(failed.mode.requestProgressReset(), 'confirm');
  assert.equal(failed.mode.requestProgressReset(), 'memory-only');
  assert.equal(failed.mode.state.resetResult, 'memory-only');
}

{
  const { mode } = createHarness(0);
  mode.startCurrentStage();
  for (let stageIndex = 0; stageIndex < 5; stageIndex++) {
    assert.equal(mode.state.stageIndex, stageIndex);
    Object.assign(mode.state, {
      title: false,
      over: true,
      win: true,
      saved: true,
      clearedStars: stageIndex + 1,
    });
    const result = mode.resolveResult();
    if (stageIndex < 4) {
      assert.deepEqual(result, { kind: 'next', stageIndex: stageIndex + 1 });
      assert.equal(mode.state.title, false);
    } else {
      assert.deepEqual(result, { kind: 'complete', stageIndex: 4 });
      assert.equal(mode.state.title, true, '第五关胜利应凯旋归营');
    }
  }

  mode.startCurrentStage();
  Object.assign(mode.state, { over: true, win: false, saved: true });
  assert.deepEqual(mode.resolveResult(), { kind: 'replay', stageIndex: 4 });
  assert.equal(mode.state.stageIndex, 4);
  assert.equal(mode.state.title, false);
}

{
  const state = fakeState(1, 1);
  state.title = false;
  const published = [];
  const result = consumeFixedRouteCampaignDomainEvents(state, [
    { type: 'combat.enemy_defeated', tick: 1, payload: {} },
    { type: 'encounter.completed', tick: 42, payload: {
      result: 'victory', reason: 'all-waves-cleared', wave: 6,
    } },
  ], {
    publishDomainEvent(receivedState, definition) {
      assert.equal(receivedState, state);
      published.push(definition);
    },
  });
  assert.deepEqual(result, { consumed: 1, completed: true, result: 'victory' });
  assert.equal(state.over, true);
  assert.equal(state.win, true);
  assert.deepEqual(published, [{
    type: 'match.ended', source: 'match-controller', tick: 42,
    payload: { result: 'victory', reason: 'all-waves-cleared', wave: 6 },
  }]);

  const getState = () => state;
  const handlers = createFixedRouteCampaignDomainEventHandlers({
    getState,
    publishDomainEvent: (_state, definition) => published.push(definition),
  });
  assert.deepEqual(Object.keys(handlers), ['encounter.completed']);
  assert.deepEqual(handlers['encounter.completed']({
    type: 'encounter.completed', tick: 43,
    payload: { result: 'defeat', reason: 'lives-depleted', wave: 3 },
  }), { consumed: 1, completed: true, result: 'defeat' });
  assert.equal(state.win, false);
}

{
  const { mode } = createHarness(2);
  const clockTrace = [];
  const invalidTrace = [];
  const handlers = createFixedRouteCampaignCommandHandlers({
    matchMode: mode,
    clockControls: {
      setSimulationPaused(state, paused) {
        clockTrace.push(['pause', paused]);
        state.speed = paused ? 0 : state.resumeSpeed;
        return { paused, speed: state.speed };
      },
      setSimulationSpeed(state, speed) {
        clockTrace.push(['speed', speed]);
        if (speed > 0) state.resumeSpeed = speed;
        state.speed = speed;
        return { speed: state.speed };
      },
    },
    invalid: (_command, reason) => {
      invalidTrace.push(reason);
      return { ok: false, reason };
    },
  });
  assert.deepEqual(Object.keys(handlers), FIXED_ROUTE_MATCH_COMMAND_TYPES);

  assert.deepEqual(handlers['campaign.select_stage'](command('campaign.select_stage', { stageIndex: 2 })), {
    ok: true, reason: 'none', stageIndex: 2,
  });
  assert.equal(handlers['campaign.start_stage'](command('campaign.start_stage')).ok, true);
  assert.equal(handlers['battle.set_paused'](command('battle.set_paused', { paused: true })).speed, 0);
  assert.equal(handlers['battle.set_speed'](command('battle.set_speed', { speed: 2 })).speed, 2);
  assert.deepEqual(clockTrace, [['pause', true], ['speed', 2]]);
  assert.deepEqual(handlers['battle.set_speed'](command('battle.set_speed', { speed: 3 })), {
    ok: false, reason: 'invalid-speed',
  });
  assert.deepEqual(invalidTrace, ['invalid-speed']);
}

assert.equal('ScriptedBotController' in matchModePublic, false);
assert.equal('ReplayController' in matchModePublic, false);
assert.equal('RemotePlayerController' in matchModePublic, false);

console.log('✓ MatchMode 授权、固定路线生命周期、五关流转、命令处理与领域事件消费');
