const DOMAIN_TO_TELEMETRY = Object.freeze({
  'match.started': ({ payload }) => ({
    eventId: 'stage_start',
    details: {
      result: 'started',
      reason: payload.reason ?? 'player-start',
    },
  }),
  'match.retry_requested': ({ payload }) => ({
    eventId: 'retry',
    details: {
      result: 'started',
      reason: payload.reason ?? 'manual-retry',
    },
  }),
  'match.quit_requested': ({ payload }) => ({
    eventId: 'quit',
    details: {
      result: 'abandoned',
      reason: payload.reason ?? 'player-quit',
    },
  }),
  'match.ended': ({ payload }) => ({
    eventId: 'stage_end',
    details: {
      result: payload.result === 'victory'
        ? 'won'
        : payload.result === 'defeat'
          ? 'lost'
          : 'abandoned',
      // 对外 Telemetry 保留候选基座既有 reason；领域内部可使用更精确的关卡事实。
      reason: payload.result === 'victory'
        ? 'waves-cleared'
        : payload.result === 'defeat'
          ? 'lives-depleted'
          : payload.reason ?? 'match-ended',
    },
  }),
  'command.rejected': ({ tick, payload }) => ({
    eventId: 'invalid_action',
    details: {
      result: 'failure',
      reason: payload.reason,
      actionId: payload.commandType,
      domainTick: tick,
    },
  }),
  'encounter.wave_started': ({ payload }) => ({
    eventId: 'wave_start',
    details: { result: 'started', reason: payload.reason, wave: payload.wave },
  }),
  'encounter.wave_completed': ({ payload }) => ({
    eventId: 'wave_end',
    details: { result: 'cleared', reason: payload.reason, wave: payload.wave, reward: payload.reward },
  }),
  'combat.enemy_leaked': ({ payload }, state) => ({
    eventId: 'enemy_leak',
    details: {
      result: 'life-lost', reason: 'reached-gate', enemyId: payload.enemyType,
      laneId: String(payload.lane), livesBefore: state?.lives,
      livesRemaining: Math.max(0, Number(state?.lives ?? 0) - 1),
    },
  }),
  'skill.cast': ({ payload }) => ({
    eventId: 'hero_cast',
    details: {
      result: 'success', reason: payload.reason,
      heroId: payload.heroId, skillId: payload.skillId,
    },
  }),
});

export function deriveTelemetryFromDomainEvent(event, state) {
  try { return DOMAIN_TO_TELEMETRY[event?.type]?.(event, state) ?? null; }
  catch { return null; }
}

export function createDomainTelemetryBridge({ reporter, onError } = {}) {
  if (!reporter || typeof reporter.emit !== 'function') {
    throw new TypeError('[telemetry-bridge] reporter.emit is required');
  }
  return Object.freeze({
    forward(event, state) {
      const mapped = deriveTelemetryFromDomainEvent(event, state);
      if (!mapped) return false;
      try { return reporter.emit(mapped.eventId, state, mapped.details); }
      catch (error) {
        try { onError?.(error, event); } catch { /* Telemetry 失败不能中断玩法。 */ }
        return false;
      }
    },
  });
}
