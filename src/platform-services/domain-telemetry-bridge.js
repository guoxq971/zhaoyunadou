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
  'economy.reward_granted': ({ payload }) => (payload.reason === 'wave-completed' ? {
    eventId: 'wave_end',
    details: {
      result: 'cleared', reason: 'enemies-cleared',
      wave: payload.wave, reward: payload.amount,
    },
  } : null),
  'encounter.enemy_leak_resolved': ({ payload }) => ({
    eventId: 'enemy_leak',
    details: {
      result: 'life-lost', reason: 'reached-gate', enemyId: payload.enemyType,
      laneId: String(payload.lane), livesBefore: payload.livesBefore,
      livesRemaining: payload.livesRemaining,
    },
  }),
  'skill.cast': ({ payload }) => ({
    eventId: 'hero_cast',
    details: {
      result: 'success', reason: payload.reason,
      heroId: payload.heroId, skillId: payload.skillId,
    },
  }),
  'economy.recruit_attempted': ({ payload }) => ({
    eventId: 'recruit_attempt',
    details: {
      result: 'attempted', reason: 'none', cost: payload.cost,
      recruitIndex: payload.recruitIndex,
    },
  }),
  'economy.recruit_completed': ({ tick, payload }) => {
    const result = {
      eventId: 'recruit_result',
      details: {
        result: payload.ok ? 'success' : 'failure', reason: payload.reason,
        cost: payload.cost, itemKind: payload.itemKind, itemId: payload.itemId, slot: payload.slot,
      },
    };
    return payload.ok ? result : [result, {
      eventId: 'invalid_action',
      details: {
        result: 'failure', reason: payload.reason, actionId: 'recruit', domainTick: tick,
      },
    }];
  },
  'formation.merged': ({ payload }) => ({
    eventId: 'merge',
    details: {
      result: 'success', reason: 'none', unitId: payload.itemId,
      itemKind: payload.itemKind, level: payload.level, cell: payload.cell,
      pieceId: payload.pieceId,
    },
  }),
  'formation.hero_unlocked': ({ payload }) => ({
    eventId: 'hero_unlock',
    details: { result: 'success', reason: 'pair-completed', heroId: payload.heroId },
  }),
  'board.piece_moved': ({ payload }) => (payload.target?.zone === 'grid' ? {
    eventId: 'deploy',
    details: {
      result: 'success', reason: 'none', unitId: payload.itemId,
      itemKind: payload.itemKind, action: 'move',
      cell: { r: payload.target.r, c: payload.target.c },
      source: payload.source?.zone, pieceId: payload.pieceId,
    },
  } : null),
  'board.pieces_swapped': ({ payload }) => (payload.target?.zone === 'grid' ? {
    eventId: 'deploy',
    details: {
      result: 'success', reason: 'none', unitId: payload.itemId,
      itemKind: payload.itemKind, action: 'swap',
      cell: { r: payload.target.r, c: payload.target.c },
      source: payload.source?.zone, pieceId: payload.pieceId,
    },
  } : null),
  'item.used': ({ payload }) => (payload.itemId === 'shovel' ? {
    eventId: 'deploy',
    details: {
      result: 'success', reason: 'none', unitId: 'shovel',
      cell: { r: payload.r, c: payload.c }, source: payload.source ?? 'bench',
    },
  } : null),
});

function derivedTelemetry(event, state) {
  const mapped = DOMAIN_TO_TELEMETRY[event?.type]?.(event, state) ?? null;
  return (Array.isArray(mapped) ? mapped : mapped ? [mapped] : []).filter(Boolean);
}

export function deriveTelemetryFromDomainEvent(event, state) {
  try { return derivedTelemetry(event, state)[0] ?? null; }
  catch { return null; }
}

export function deriveTelemetryEventsFromDomainEvent(event, state) {
  try { return Object.freeze(derivedTelemetry(event, state).map((entry) => Object.freeze(entry))); }
  catch { return Object.freeze([]); }
}

export function createDomainTelemetryBridge({ reporter, onError } = {}) {
  if (!reporter || typeof reporter.emit !== 'function') {
    throw new TypeError('[telemetry-bridge] reporter.emit is required');
  }
  return Object.freeze({
    forward(event, state) {
      const mappedEvents = deriveTelemetryEventsFromDomainEvent(event, state);
      if (mappedEvents.length === 0) return false;
      let forwarded = false;
      for (const mapped of mappedEvents) {
        try { forwarded = reporter.emit(mapped.eventId, state, mapped.details) || forwarded; }
        catch (error) {
          try { onError?.(error, event); } catch { /* Telemetry 失败不能中断玩法。 */ }
        }
      }
      return forwarded;
    },
  });
}
