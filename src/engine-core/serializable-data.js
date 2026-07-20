const STABLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export function assertStableId(value, field = 'id') {
  if (typeof value !== 'string' || !STABLE_ID_PATTERN.test(value)) {
    throw new TypeError(`[foundation] ${field} must be a stable id`);
  }
  return value;
}

export function assertSerializableData(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('[foundation] value must be serializable');
    seen.add(value);
    value.forEach((entry) => assertSerializableData(entry, seen));
    seen.delete(value);
    return value;
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError('[foundation] value must be serializable plain data');
  }
  if (seen.has(value)) throw new TypeError('[foundation] value must be serializable');
  seen.add(value);
  Object.values(value).forEach((entry) => assertSerializableData(entry, seen));
  seen.delete(value);
  return value;
}

export function cloneSerializableData(value) {
  assertSerializableData(value);
  return JSON.parse(JSON.stringify(value));
}

export function deepFreezeData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreezeData);
  return Object.freeze(value);
}

export function immutableData(value) {
  return deepFreezeData(cloneSerializableData(value));
}
