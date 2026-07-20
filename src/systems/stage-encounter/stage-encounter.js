import { getStateSlice } from '../../engine-core/public.js';
import { createEnemySpawnDefinition, pickEnemyType } from './rules.js';

const noPublish = () => null;
export const createStageEncounterStateSlice = ({ config, stage } = {}) => {
  if (!config || !stage) throw new TypeError('[stage-encounter] config and active stage are required');
  return {
    lives: config.startLives,
    waveTarget: stage.waveCount,
    wave: 0,
    phase: 'break',
    phaseT: null,
    spawnLeft: 0,
    spawnTotal: 0,
    spawnT: 0,
    nextEnemySequence: 0,
    completed: false,
    result: null,
  };
};

export function nextEncounterEnemyId(state) {
  const encounter = getStateSlice(state, 'encounter');
  encounter.nextEnemySequence = (encounter.nextEnemySequence ?? 0) + 1;
  return `enemy-${encounter.nextEnemySequence}`;
}
const tickOf = (tick) => {
  const value = Number(tick ?? 0);
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError('[stage-encounter] tick must be a non-negative integer');
  }
  return value;
};

function contextFor(state, gamePack, ports = {}) {
  if (!gamePack?.config?.waves || !gamePack?.config?.enemy) {
    throw new TypeError('[stage-encounter] a compiled Game Pack is required');
  }
  const stage = ports.getStage?.(state);
  if (!stage) throw new TypeError('[stage-encounter] getStage port must return the active stage');
  return {
    encounter: getStateSlice(state, 'encounter'),
    stage,
    waves: gamePack.config.waves,
    publish: ports.publishDomainEvent ?? noPublish,
  };
}

function publish(state, context, type, tick, payload) {
  return context.publish(state, {
    type,
    source: 'stage-encounter',
    tick: tickOf(tick),
    payload,
  });
}

function completeEncounter(state, context, result, reason, tick) {
  const { encounter } = context;
  if (encounter.completed) return false;
  encounter.completed = true;
  encounter.result = result;
  publish(state, context, 'encounter.completed', tick, {
    result,
    reason,
    wave: encounter.wave,
    livesRemaining: encounter.lives,
  });
  return true;
}

// 命令只改 Encounter 计时状态，真正开波仍在确定性 tick 内发生。
export function requestWaveStart(state, tick = 0, { canStartWave = () => true } = {}) {
  const encounter = getStateSlice(state, 'encounter');
  if (!canStartWave(state) || encounter.completed || encounter.phase !== 'break') {
    return { ok: false, reason: 'wave-not-ready' };
  }
  tickOf(tick);
  encounter.phaseT = 0;
  return { ok: true, reason: 'none', wave: encounter.wave + 1 };
}

function startNextWave(state, context, tick) {
  const { encounter, waves } = context;
  encounter.wave++;
  encounter.phase = 'wave';
  encounter.spawnLeft = waves.size(encounter.wave);
  encounter.spawnTotal = encounter.spawnLeft;
  encounter.spawnT = 0;
  publish(state, context, 'encounter.wave_started', tick, {
    wave: encounter.wave,
    total: encounter.spawnTotal,
    reason: 'countdown-complete',
  });
  return { ok: true, reason: 'none', action: 'wave-started', wave: encounter.wave };
}

function spawnNextEnemy(state, gamePack, context, ports, tick) {
  const { encounter, stage, waves } = context;
  if (typeof ports.acceptEnemySpawn !== 'function') {
    return { ok: false, reason: 'enemy-spawn-port-unavailable', action: 'none' };
  }
  const total = encounter.spawnTotal ?? waves.size(encounter.wave);
  const index = total - encounter.spawnLeft;
  const laneCount = ports.getLaneCount?.(state) ?? 1;
  const type = pickEnemyType({ ...stage, waveTarget: encounter.waveTarget }, encounter.wave, index, total);
  const enemy = createEnemySpawnDefinition({
    gamePack,
    stage,
    wave: encounter.wave,
    type,
    index,
    laneCount,
    spawnedAt: ports.getElapsedTime?.(state) ?? 0,
    enemyId: nextEncounterEnemyId(state),
  });
  let accepted;
  try { accepted = ports.acceptEnemySpawn(state, enemy); }
  catch { return { ok: false, reason: 'enemy-spawn-port-error', action: 'none' }; }
  if (accepted === false) return { ok: false, reason: 'enemy-spawn-rejected', action: 'none' };

  encounter.spawnLeft--;
  encounter.spawnT = waves.spawnInterval;
  publish(state, context, 'encounter.enemy_spawned', tick, {
    wave: encounter.wave,
    index,
    total,
    enemy,
  });
  return { ok: true, reason: 'none', action: 'enemy-spawned', enemy };
}

function completeWave(state, context, tick) {
  const { encounter, waves } = context;
  const reward = waves.waveBonus(encounter.wave);
  publish(state, context, 'encounter.wave_completed', tick, {
    wave: encounter.wave,
    reward,
    reason: 'enemies-cleared',
  });
  if (encounter.wave >= encounter.waveTarget) {
    completeEncounter(state, context, 'victory', 'all-waves-cleared', tick);
    return { ok: true, reason: 'none', action: 'encounter-completed', result: 'victory', reward };
  }
  encounter.phase = 'break';
  encounter.phaseT = waves.breakTime;
  return { ok: true, reason: 'none', action: 'wave-completed', wave: encounter.wave, reward };
}

export function updateStageEncounter(state, dt, gamePack, ports = {}, tick = 0) {
  const elapsed = Number(dt);
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError('[stage-encounter] dt must be a non-negative finite number');
  }
  const context = contextFor(state, gamePack, ports);
  const { encounter } = context;
  if (encounter.completed) return { ok: false, reason: 'encounter-completed', action: 'none' };

  if (encounter.phase === 'break') {
    if (encounter.phaseT === null) return { ok: false, reason: 'awaiting-player', action: 'none' };
    encounter.phaseT -= elapsed;
    if (encounter.phaseT <= 0) return startNextWave(state, context, tick);
    return { ok: true, reason: 'none', action: 'countdown' };
  }

  if (encounter.phase !== 'wave') {
    return { ok: false, reason: 'invalid-encounter-phase', action: 'none' };
  }
  if (encounter.spawnLeft > 0) {
    encounter.spawnT -= elapsed;
    if (encounter.spawnT <= 0) return spawnNextEnemy(state, gamePack, context, ports, tick);
    return { ok: true, reason: 'none', action: 'spawn-countdown' };
  }
  if (typeof ports.hasActiveEnemies !== 'function') {
    return { ok: false, reason: 'active-enemies-port-unavailable', action: 'none' };
  }
  let hasActiveEnemies;
  try { hasActiveEnemies = ports.hasActiveEnemies(state); }
  catch { return { ok: false, reason: 'active-enemies-port-error', action: 'none' }; }
  return hasActiveEnemies
    ? { ok: true, reason: 'none', action: 'awaiting-enemies' }
    : completeWave(state, context, tick);
}

// Combat 只报告漏敌事实；扣除关卡生命及失败判定仍由 Encounter 拥有。
export function consumeStageEncounterDomainEvents(state, events, ports = {}) {
  const encounter = getStateSlice(state, 'encounter');
  const publishContext = { encounter, publish: ports.publishDomainEvent ?? noPublish };
  let consumed = 0;
  let completed = false;
  for (const event of events ?? []) {
    if (event?.type === 'combat.enemy_defeated') {
      consumed++;
      continue;
    }
    if (event?.type !== 'combat.enemy_leaked') continue;
    consumed++;
    const livesBefore = encounter.lives;
    encounter.lives = Math.max(0, encounter.lives - 1);
    publish(state, publishContext, 'encounter.enemy_leak_resolved', event.tick ?? 0, {
      enemyId: event.payload.enemyId,
      enemyType: event.payload.enemyType,
      wave: event.payload.wave,
      lane: event.payload.lane,
      livesBefore,
      livesRemaining: encounter.lives,
    });
    if (encounter.lives === 0 && !encounter.completed) {
      completed = completeEncounter(
        state,
        publishContext,
        'defeat',
        'lives-depleted',
        event.tick ?? 0,
      );
    }
  }
  return {
    consumed,
    completed,
    result: completed ? 'defeat' : encounter.result ?? null,
  };
}

export function createStageEncounterCommandHandlers({
  getState,
  canStartWave = () => true,
  invalid = null,
} = {}) {
  if (typeof getState !== 'function') {
    throw new TypeError('[stage-encounter] getState is required');
  }
  return Object.freeze({
    'battle.start_wave': (command) => {
      const result = requestWaveStart(getState(), command?.tick ?? 0, { canStartWave });
      return !result.ok && typeof invalid === 'function'
        ? invalid(command, result.reason)
        : result;
    },
  });
}
