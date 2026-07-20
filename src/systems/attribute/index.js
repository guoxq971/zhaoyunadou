import { assertStableId, getStateSlice } from '../../engine-core/public.js';

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

export function resolveStat(baseValue, stat, modifiers = [], state = null) {
  let globalModifiers = [];
  if (state) {
    try { globalModifiers = getStateSlice(state, 'attributes').modifiers; }
    catch { /* 兼容手写旧状态。 */ }
  }
  return applyStatModifiers(baseValue, [...globalModifiers, ...(modifiers ?? [])], stat);
}

export function troopDamage(baseDamage, level, levelMultiplier, modifiers = [], state = null) {
  const scaled = Math.round(baseDamage * Math.pow(levelMultiplier, level - 1));
  return resolveStat(scaled, 'damage', modifiers, state);
}

export function addGlobalModifier(state, modifier) {
  assertStatModifier(modifier);
  const slice = getStateSlice(state, 'attributes');
  if (slice.modifiers.some(({ id }) => id === modifier.id)) {
    throw new Error(`[attribute] duplicate modifier "${modifier.id}"`);
  }
  slice.modifiers.push(Object.freeze({ ...modifier }));
  slice.modifiers.sort(compareStatModifiers);
  return modifier.id;
}

export function removeGlobalModifier(state, modifierId) {
  const slice = getStateSlice(state, 'attributes');
  const index = slice.modifiers.findIndex(({ id }) => id === modifierId);
  if (index < 0) return false;
  slice.modifiers.splice(index, 1);
  return true;
}
