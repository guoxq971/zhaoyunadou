import { immutableSnapshot } from '../engine-core/events.js';

// 本地采集器只存内存，不读写持久层，也不发送网络请求。
export function createLocalEventCollector({ limit = 5_000 } = {}) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError('[events] local collector limit must be a positive integer');
  }

  const events = [];
  let dropped = 0;

  function emit(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new TypeError('[events] collected event must be an object');
    }
    events.push(immutableSnapshot(event));
    if (events.length > limit) {
      events.splice(0, events.length - limit);
      dropped++;
    }
    return true;
  }

  return Object.freeze({
    emit,
    // collect 别名让未来平台适配器可以使用 collector 语义而无需包装。
    collect: emit,
    get size() { return events.length; },
    get dropped() { return dropped; },
    getEvents() { return immutableSnapshot(events); },
    clear() {
      events.length = 0;
      dropped = 0;
    },
  });
}
