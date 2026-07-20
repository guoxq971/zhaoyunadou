const DOMAIN_TO_TELEMETRY = Object.freeze({
  'command.rejected': ({ tick, payload }) => ({
    eventId: 'invalid_action',
    details: {
      result: 'failure',
      reason: payload.reason,
      actionId: payload.commandType,
      domainTick: tick,
    },
  }),
});

export function deriveTelemetryFromDomainEvent(event) {
  try { return DOMAIN_TO_TELEMETRY[event?.type]?.(event) ?? null; }
  catch { return null; }
}

export function createDomainTelemetryBridge({ reporter, onError } = {}) {
  if (!reporter || typeof reporter.emit !== 'function') {
    throw new TypeError('[telemetry-bridge] reporter.emit is required');
  }
  return Object.freeze({
    forward(event, state) {
      const mapped = deriveTelemetryFromDomainEvent(event);
      if (!mapped) return false;
      try { return reporter.emit(mapped.eventId, state, mapped.details); }
      catch (error) {
        try { onError?.(error, event); } catch { /* Telemetry 失败不能中断玩法。 */ }
        return false;
      }
    },
  });
}
