import { assertDomainEvent } from './domain-event.js';
import { assertStableId } from './serializable-data.js';

export const DOMAIN_EVENT_DISPATCHER_API_VERSION = '1.0.0';

function normalizeConsumers(consumers) {
  const seen = new Set();
  return (consumers ?? []).map(({ systemId, handlers }) => {
    assertStableId(systemId, 'systemId');
    if (seen.has(systemId)) throw new Error(`[domain-event] duplicate consumer system "${systemId}"`);
    seen.add(systemId);
    const entries = handlers instanceof Map ? [...handlers] : Object.entries(handlers ?? {});
    const map = new Map();
    for (const [type, handler] of entries) {
      assertStableId(type, 'event type');
      if (typeof handler !== 'function') throw new TypeError(`[domain-event] ${systemId}.${type} handler must be a function`);
      if (map.has(type)) throw new Error(`[domain-event] duplicate handler ${systemId}.${type}`);
      map.set(type, handler);
    }
    return Object.freeze({ systemId, handlers: map });
  });
}

// 一个事件可由多个系统消费；消费顺序只由 composition root 的注册顺序决定。
export function createDomainEventDispatcher(consumers = [], { maxEventsPerPump = 1024 } = {}) {
  if (!Number.isInteger(maxEventsPerPump) || maxEventsPerPump < 1) {
    throw new RangeError('[domain-event] maxEventsPerPump must be positive');
  }
  const ordered = normalizeConsumers(consumers);

  function dispatch(event, state, context) {
    assertDomainEvent(event);
    const results = [];
    for (const consumer of ordered) {
      const handler = consumer.handlers.get(event.type);
      if (!handler) continue;
      results.push(Object.freeze({ systemId: consumer.systemId, result: handler(event, state, context) }));
    }
    return Object.freeze(results);
  }

  function pump(queue, state, context) {
    if (!queue || typeof queue.drain !== 'function') throw new TypeError('[domain-event] queue.drain is required');
    let processed = 0;
    const deliveries = [];
    // handler 可同步发布新领域事件；继续批次处理，但用上限拦截事件环。
    while (queue.size > 0) {
      const batch = queue.drain();
      for (const event of batch) {
        processed++;
        if (processed > maxEventsPerPump) throw new Error('[domain-event] pump limit exceeded');
        deliveries.push(...dispatch(event, state, context).map((delivery) => ({
          eventSequence: event.sequence,
          eventType: event.type,
          ...delivery,
        })));
      }
    }
    return Object.freeze({ processed, deliveries: Object.freeze(deliveries) });
  }

  return Object.freeze({ dispatch, pump, systems: Object.freeze(ordered.map(({ systemId }) => systemId)) });
}
