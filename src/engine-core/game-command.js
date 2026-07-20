export const GAME_COMMAND_API_VERSION = '1.0.0';

const TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

function assertSerializable(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('[game-command] payload must be serializable');
    seen.add(value);
    value.forEach((entry) => assertSerializable(entry, seen));
    seen.delete(value);
    return;
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError('[game-command] payload must be serializable plain data');
  }
  if (seen.has(value)) throw new TypeError('[game-command] payload must be serializable');
  seen.add(value);
  Object.values(value).forEach((entry) => assertSerializable(entry, seen));
  seen.delete(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

export function assertGameCommand(command) {
  if (!command || typeof command !== 'object') throw new TypeError('[game-command] command is required');
  if (command.apiVersion !== GAME_COMMAND_API_VERSION) throw new TypeError('[game-command] unsupported apiVersion');
  for (const field of ['type', 'actorId', 'side']) {
    if (typeof command[field] !== 'string' || !TYPE_PATTERN.test(command[field])) {
      throw new TypeError(`[game-command] ${field} must be a stable id`);
    }
  }
  for (const field of ['sequence', 'tick']) {
    if (!Number.isInteger(command[field]) || command[field] < 0) {
      throw new TypeError(`[game-command] ${field} must be a non-negative integer`);
    }
  }
  if (!Number.isFinite(command.time) || command.time < 0) {
    throw new TypeError('[game-command] time must be a non-negative finite number');
  }
  assertSerializable(command.payload);
  return command;
}

export function createCommandFactory({
  actorId,
  side,
  getTick = () => 0,
  getTime = () => 0,
  initialSequence = 0,
} = {}) {
  let sequence = initialSequence;
  return Object.freeze({
    create(type, payload = {}) {
      assertSerializable(payload);
      const command = {
        apiVersion: GAME_COMMAND_API_VERSION,
        type,
        actorId,
        side,
        sequence: ++sequence,
        tick: Number(getTick()),
        time: Number(getTime()),
        payload: cloneData(payload),
      };
      assertGameCommand(command);
      return deepFreeze(command);
    },
    get sequence() { return sequence; },
  });
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

// 轻量 FNV-1a 仅用于本地诊断/回放断言，不作为安全或反作弊哈希。
export function hashCommandState(value) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createCommandLog({ limit = 256, header = {} } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('[game-command] log limit must be positive');
  const entries = [];
  let dropped = 0;
  assertSerializable(header);
  return Object.freeze({
    record(entry) {
      assertSerializable(entry);
      entries.push(deepFreeze(cloneData(entry)));
      while (entries.length > limit) { entries.shift(); dropped++; }
    },
    getEntries() { return Object.freeze(entries.map((entry) => deepFreeze(cloneData(entry)))); },
    get header() { return deepFreeze(cloneData(header)); },
    get size() { return entries.length; },
    get dropped() { return dropped; },
    clear() { entries.length = 0; dropped = 0; },
  });
}

export function createCommandDispatcher({ handlers, getStateSummary, commandLog, onRejected, onError } = {}) {
  if (!handlers || typeof handlers !== 'object') throw new TypeError('[game-command] handlers are required');
  if (typeof getStateSummary !== 'function') throw new TypeError('[game-command] getStateSummary is required');
  const lastSequence = new Map();

  function reject(command, reason) {
    const result = { ok: false, reason };
    try { onRejected?.(command, result); } catch { /* 诊断失败不反向中断规则 */ }
    return result;
  }

  function dispatch(command) {
    assertGameCommand(command);
    const beforeHash = hashCommandState(getStateSummary());
    const previous = lastSequence.get(command.actorId) ?? -1;
    let result;
    if (command.sequence <= previous) result = reject(command, 'stale-sequence');
    else {
      lastSequence.set(command.actorId, command.sequence);
      const handler = handlers[command.type];
      if (typeof handler !== 'function') result = reject(command, 'unknown-command');
      else {
        try { result = handler(command) ?? { ok: true, reason: 'none' }; }
        catch (error) {
          try { onError?.(error, command); } catch { /* 诊断失败不反向中断规则 */ }
          result = reject(command, 'handler-error');
        }
      }
    }
    assertSerializable(result);
    const stateHash = hashCommandState(getStateSummary());
    commandLog?.record({ command, result, beforeHash, stateHash });
    return result;
  }

  return Object.freeze({ dispatch });
}
