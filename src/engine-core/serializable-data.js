const STABLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export function assertStableId(value, field = 'id') {
  if (typeof value !== 'string' || !STABLE_ID_PATTERN.test(value)) {
    throw new TypeError(`[foundation] ${field} must be a stable id`);
  }
  return value;
}

// 确定性协议不应受 Host locale / ICU 排序差异影响。
export function compareCodePointStrings(left, right) {
  const leftText = String(left);
  const rightText = String(right);
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

function ownSerializableEntries(value) {
  const entries = [];
  const keys = Reflect.ownKeys(value);

  if (Array.isArray(value)) {
    for (const key of keys) {
      if (key === 'length') continue;
      if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)
        || Number(key) >= value.length) {
        throw new TypeError('[foundation] array must contain only serializable indexed data');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('[foundation] array entries must be enumerable serializable data properties');
      }
      entries.push([key, descriptor.value]);
    }
    if (entries.length !== value.length) {
      throw new TypeError('[foundation] sparse arrays are not serializable data');
    }
    return entries.sort(([left], [right]) => Number(left) - Number(right));
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      throw new TypeError('[foundation] symbol properties are not serializable data');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('[foundation] object properties must be enumerable serializable data properties');
    }
    entries.push([key, descriptor.value]);
  }
  return entries;
}

export function assertSerializableData(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('[foundation] value must be serializable');
    seen.add(value);
    try {
      ownSerializableEntries(value).forEach(([, entry]) => assertSerializableData(entry, seen));
    } finally {
      seen.delete(value);
    }
    return value;
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError('[foundation] value must be serializable plain data');
  }
  if (seen.has(value)) throw new TypeError('[foundation] value must be serializable');
  seen.add(value);
  try {
    ownSerializableEntries(value).forEach(([, entry]) => assertSerializableData(entry, seen));
  } finally {
    seen.delete(value);
  }
  return value;
}

export function cloneSerializableData(value) {
  assertSerializableData(value);
  function clone(entry) {
    if (entry === null || typeof entry !== 'object') return entry;
    if (Array.isArray(entry)) {
      return ownSerializableEntries(entry).map(([, item]) => clone(item));
    }
    const result = {};
    for (const [key, item] of ownSerializableEntries(entry)) {
      Object.defineProperty(result, key, {
        value: clone(item),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  }
  return clone(value);
}

export function deepFreezeData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreezeData);
  return Object.freeze(value);
}

export function immutableData(value) {
  return deepFreezeData(cloneSerializableData(value));
}
