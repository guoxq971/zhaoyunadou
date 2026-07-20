import {
  assertSerializableData,
  assertStableId,
  immutableData,
} from './serializable-data.js';

export const DOMAIN_EVENT_API_VERSION = '1.0.0';
export const DOMAIN_EVENT_PROTOCOL = 'domain-event';
const DOMAIN_EVENT_FIELDS = new Set([
  'apiVersion', 'protocol', 'type', 'source', 'sequence', 'tick', 'payload',
]);

// 拒绝事实由 Foundation 定义，具体 dispatcher 只补入命令上下文并发布。
export function commandRejectedDomainEvent({ tick, commandType, reason }) {
  return immutableData({
    type: 'command.rejected',
    source: 'foundation-runtime',
    tick,
    payload: { commandType, reason },
  });
}

export function assertDomainEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)
    || Object.getPrototypeOf(event) !== Object.prototype) {
    throw new TypeError('[domain-event] event must be serializable plain data');
  }
  const unexpected = Reflect.ownKeys(event).filter((field) => !DOMAIN_EVENT_FIELDS.has(field));
  if (unexpected.length > 0) {
    throw new TypeError(`[domain-event] unexpected field(s): ${unexpected.map(String).join(', ')}`);
  }
  assertSerializableData(event);
  if (event.apiVersion !== DOMAIN_EVENT_API_VERSION) {
    throw new TypeError('[domain-event] unsupported apiVersion');
  }
  if (event.protocol !== DOMAIN_EVENT_PROTOCOL) throw new TypeError('[domain-event] invalid protocol');
  assertStableId(event.type, 'type');
  assertStableId(event.source, 'source');
  for (const field of ['sequence', 'tick']) {
    if (!Number.isInteger(event[field]) || event[field] < 0) {
      throw new TypeError(`[domain-event] ${field} must be a non-negative integer`);
    }
  }
  return event;
}

// 每个对局拥有一个有上限的轻量队列；不保存墙钟、session 或平台对象。
export function createDomainEventQueue({ limit = 512, initialSequence = 0 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('[domain-event] limit must be positive');
  if (!Number.isInteger(initialSequence) || initialSequence < 0) {
    throw new RangeError('[domain-event] initialSequence must be non-negative');
  }
  const events = [];
  let sequence = initialSequence;
  let dropped = 0;

  function publish({ type, source, tick, payload = {} } = {}) {
    const candidate = {
      apiVersion: DOMAIN_EVENT_API_VERSION,
      protocol: DOMAIN_EVENT_PROTOCOL,
      type,
      source,
      sequence: sequence + 1,
      tick,
      payload,
    };
    assertDomainEvent(candidate);
    sequence++;
    const event = immutableData(candidate);
    events.push(event);
    if (events.length > limit) {
      events.splice(0, events.length - limit);
      dropped++;
    }
    return event;
  }

  const snapshot = () => Object.freeze([...events]);
  return Object.freeze({
    publish,
    peek: snapshot,
    drain() {
      const drained = snapshot();
      events.length = 0;
      return drained;
    },
    clear() { events.length = 0; },
    get size() { return events.length; },
    get sequence() { return sequence; },
    get dropped() { return dropped; },
  });
}
