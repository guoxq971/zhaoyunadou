import { assertStableId } from '../../engine-core/public.js';

export const STAT_MODIFIER_API_VERSION = '1.0.0';
const OPERATIONS = new Set(['add', 'multiply', 'override']);

export function assertStatModifier(modifier) {
  if (!modifier || typeof modifier !== 'object' || Array.isArray(modifier)) {
    throw new TypeError('[modifier] modifier must be an object');
  }
  assertStableId(modifier.id, 'modifier.id');
  assertStableId(modifier.stat, 'modifier.stat');
  if (!OPERATIONS.has(modifier.operation)) throw new TypeError('[modifier] unsupported operation');
  if (!Number.isFinite(modifier.value)) throw new TypeError('[modifier] value must be finite');
  if (!Number.isInteger(modifier.priority)) throw new TypeError('[modifier] priority must be an integer');
  return modifier;
}

export function compareStatModifiers(left, right) {
  return left.priority - right.priority || left.id.localeCompare(right.id);
}

export function applyStatModifiers(baseValue, modifiers, stat) {
  if (!Number.isFinite(baseValue)) throw new TypeError('[modifier] baseValue must be finite');
  assertStableId(stat, 'stat');
  const ordered = modifiers
    .filter((modifier) => modifier.stat === stat)
    .map(assertStatModifier)
    .sort(compareStatModifiers);
  return ordered.reduce((value, modifier) => {
    if (modifier.operation === 'add') return value + modifier.value;
    if (modifier.operation === 'multiply') return value * modifier.value;
    return modifier.value;
  }, baseValue);
}
