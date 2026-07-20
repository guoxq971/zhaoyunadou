import assert from 'node:assert/strict';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { getStateSlice } from '../src/engine-core/public.js';
import { createGame } from '../src/state.js';
import {
  createEnemySpawnDefinition,
  createStageEncounterCommandHandlers,
  pickEnemyType,
  requestWaveStart,
  updateStageEncounter,
  consumeStageEncounterDomainEvents,
} from '../src/systems/stage-encounter/index.js';

function harness(stageIndex = 0) {
  const state = createGame(stageIndex, stageIndex);
  const events = [];
  const spawns = [];
  const ports = {
    getStage: () => state.stage,
    getLaneCount: () => state.paths.length,
    getElapsedTime: () => state.time,
    hasActiveEnemies: () => spawns.some((enemy) => !enemy.defeated),
    acceptEnemySpawn: (_state, enemy) => {
      spawns.push({ ...enemy, defeated: false });
      return true;
    },
    publishDomainEvent: (_state, event) => {
      events.push(structuredClone(event));
      return event;
    },
  };
  return { state, events, spawns, ports };
}

{
  const { state, events, ports } = harness();
  const before = structuredClone(getStateSlice(state, 'encounter'));
  const result = updateStageEncounter(state, 9, DEFAULT_GAME_PACK, ports, 1);
  assert.equal(result.reason, 'awaiting-player');
  assert.deepEqual(getStateSlice(state, 'encounter'), before, '首波待命不应偷跑计时');
  assert.deepEqual(events, []);
}

{
  const { state, events, spawns, ports } = harness();
  state.title = false;
  const handlers = createStageEncounterCommandHandlers({
    gamePack: DEFAULT_GAME_PACK,
    getState: () => state,
    ports,
  });
  assert.deepEqual(handlers['battle.start_wave']({ tick: 4, payload: {} }), {
    ok: true, reason: 'none', wave: 1,
  });
  assert.equal(state.phaseT, 0);
  assert.equal(updateStageEncounter(state, 0.01, DEFAULT_GAME_PACK, ports, 5).action, 'wave-started');
  const waveSize = DEFAULT_GAME_PACK.config.waves.size(1);
  assert.equal(state.wave, 1);
  assert.equal(state.spawnLeft, waveSize);
  assert.equal(events.at(-1).type, 'encounter.wave_started');
  assert.equal(events.at(-1).payload.total, waveSize);

  assert.equal(updateStageEncounter(state, 0.01, DEFAULT_GAME_PACK, ports, 6).action, 'enemy-spawned');
  assert.equal(spawns.length, 1, '生成必须通过 Combat 窄端口接收');
  assert.equal(spawns[0].type, 'normal');
  assert.equal(spawns[0].lane, 0);
  assert.equal(state.spawnLeft, waveSize - 1);
  assert.equal(state.spawnT, DEFAULT_GAME_PACK.config.waves.spawnInterval);
  assert.equal(events.at(-1).type, 'encounter.enemy_spawned');

  const rejected = handlers['battle.start_wave']({ tick: 7, payload: {} });
  assert.deepEqual(rejected, { ok: false, reason: 'wave-not-ready' });
}

{
  const state = createGame(4, 4);
  const total = DEFAULT_GAME_PACK.config.waves.size(5);
  assert.equal(pickEnemyType(state.stage, state.waveTarget, total - 1, total), 'boss');
  assert.equal(pickEnemyType({ ...state.stage, waveCount: 6 }, 5, total - 1, total), 'elite');
  assert.equal(pickEnemyType(state.stage, 4, 3, total), 'fast');
  assert.equal(pickEnemyType(state.stage, 4, 4, total), 'tank');

  const enemy = createEnemySpawnDefinition({
    gamePack: DEFAULT_GAME_PACK,
    stage: state.stage,
    wave: 5,
    type: 'boss',
    index: 3,
    laneCount: 2,
    spawnedAt: 12.5,
    enemyId: 'enemy-1',
  });
  const E = DEFAULT_GAME_PACK.config.enemy;
  assert.equal(enemy.hp, Math.round(E.baseHp * E.hpGrowth ** 4 * E.types.boss.hpMul * state.stage.enemyHpMul));
  assert.equal(enemy.maxHp, enemy.hp);
  assert.equal(enemy.lane, 1);
  assert.equal(enemy.speed, E.baseSpeed * E.types.boss.spdMul);
  assert.equal(enemy.spawnedAt, 12.5);
  assert.equal(Object.hasOwn(enemy, 'bob'), false, '表现浮动不属于 Encounter 生成定义');
}

{
  const { state, events, ports } = harness();
  const encounter = getStateSlice(state, 'encounter');
  state.title = false;
  state.mantou = 37;
  state.effects.push({ kind: 'sentinel' });
  encounter.wave = encounter.waveTarget;
  encounter.phase = 'wave';
  encounter.spawnLeft = 0;

  const result = updateStageEncounter(state, 0.1, DEFAULT_GAME_PACK, ports, 20);
  const bonus = DEFAULT_GAME_PACK.config.waves.waveBonus(encounter.wave);
  assert.deepEqual(result, { ok: true, reason: 'none', action: 'encounter-completed', result: 'victory', reward: bonus });
  assert.deepEqual(events.slice(-2).map((event) => event.type), [
    'encounter.wave_completed', 'encounter.completed',
  ]);
  assert.equal(events.at(-2).payload.reward, bonus);
  assert.equal(state.mantou, 37, 'Encounter 不得直写 Economy 资源');
  assert.deepEqual(state.effects, [{ kind: 'sentinel' }], 'Encounter 不得直写 Presentation');
  assert.equal(state.over, false, 'Match 结果由 encounter.completed 消费者提交');
  assert.equal(state.win, false);
  assert.equal(getStateSlice(state, 'encounter').completed, true);
  const eventCount = events.length;
  assert.equal(updateStageEncounter(state, 0.1, DEFAULT_GAME_PACK, ports, 21).reason, 'encounter-completed');
  assert.equal(events.length, eventCount, '结算事件不能重复发布');
}

{
  const { state, events, ports } = harness();
  state.title = false;
  state.lives = 2;
  const consumed = consumeStageEncounterDomainEvents(state, [{
    type: 'combat.enemy_leaked',
    tick: 31,
    payload: { enemyId: 'enemy-1', enemyType: 'normal', wave: 1, lane: 0 },
  }, {
    type: 'combat.enemy_leaked',
    tick: 31,
    payload: { enemyId: 'enemy-2', enemyType: 'fast', wave: 1, lane: 1 },
  }], ports);
  assert.deepEqual(consumed, { consumed: 2, completed: true, result: 'defeat' });
  assert.equal(state.lives, 0);
  assert.equal(state.over, false, 'Encounter 仍不直写 Match 切片');
  assert.deepEqual(
    events.filter(({ type }) => type === 'encounter.enemy_leak_resolved').map(({ payload }) => payload),
    [
      {
        enemyId: 'enemy-1', enemyType: 'normal', wave: 1, lane: 0,
        livesBefore: 2, livesRemaining: 1,
      },
      {
        enemyId: 'enemy-2', enemyType: 'fast', wave: 1, lane: 1,
        livesBefore: 1, livesRemaining: 0,
      },
    ],
    '同 tick 多漏怪必须按 Encounter 提交顺序记录精确生命变化',
  );
  assert.equal(events.at(-1).type, 'encounter.completed');
  assert.deepEqual(events.at(-1).payload, {
    result: 'defeat', reason: 'lives-depleted', wave: 0, livesRemaining: 0,
  });
}

{
  const { state, ports } = harness();
  state.title = true;
  assert.deepEqual(requestWaveStart(state, 40, {
    canStartWave: (current) => !current.title && !current.over,
  }), { ok: false, reason: 'wave-not-ready' });
  state.title = false;
  state.over = true;
  assert.deepEqual(requestWaveStart(state, 41, {
    canStartWave: (current) => !current.title && !current.over,
  }), { ok: false, reason: 'wave-not-ready' });
}

console.log('✓ Stage/Encounter 波次、Boss、敌军生成端口与胜负事件边界');
