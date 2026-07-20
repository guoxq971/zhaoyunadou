import { assertStableId } from './serializable-data.js';

// 总分发器只组合系统公开 handler map；重复命令在装配时明确失败。
export function composeCommandHandlerMaps(entries = []) {
  if (!Array.isArray(entries)) throw new TypeError('[command-handlers] entries must be an array');
  const combined = Object.create(null);
  const owners = new Map();
  for (const entry of entries) {
    assertStableId(entry?.systemId, 'systemId');
    if (!entry.handlers || typeof entry.handlers !== 'object' || Array.isArray(entry.handlers)) {
      throw new TypeError(`[command-handlers] ${entry.systemId} handlers must be an object`);
    }
    for (const [type, handler] of Object.entries(entry.handlers)) {
      assertStableId(type, 'command type');
      if (typeof handler !== 'function') throw new TypeError(`[command-handlers] ${type} handler must be a function`);
      if (owners.has(type)) {
        throw new Error(`[command-handlers] duplicate command type "${type}" from ${owners.get(type)} and ${entry.systemId}`);
      }
      owners.set(type, entry.systemId);
      combined[type] = handler;
    }
  }
  return Object.freeze(combined);
}
