import { compareCodePointStrings, getStateSlice } from '../../engine-core/public.js';

const legacySlices = new WeakMap();

export const createCombatStateSlice = () => ({
  enemies: [],
  projectiles: [],
  attackCooldowns: {},
  nextProjectileSequence: 0,
  stats: { kills: 0 },
});

// Combat 的攻击冷却和投射物序列不回写 Piece；手写旧状态仅用 WeakMap 兼容。
export function combatStateFor(state) {
  let slice;
  try {
    slice = getStateSlice(state, 'combat');
  } catch {
    if (!legacySlices.has(state)) legacySlices.set(state, {});
    slice = legacySlices.get(state);
  }
  slice.attackCooldowns ??= {};
  slice.nextProjectileSequence ??= 0;
  return slice;
}

export function attackClockId(unit, row, column) {
  return unit?.pieceId ?? `legacy-piece-${row}-${column}`;
}

export function nextProjectileId(state) {
  const slice = combatStateFor(state);
  slice.nextProjectileSequence++;
  return `projectile-${slice.nextProjectileSequence}`;
}

export function snapshotCombatRuntimeState(state) {
  const slice = combatStateFor(state);
  return {
    attackCooldowns: Object.fromEntries(
      Object.entries(slice.attackCooldowns)
        .sort(([left], [right]) => compareCodePointStrings(left, right))
        .map(([id, cooldown]) => [id, Number(cooldown.toFixed(6))]),
    ),
    nextProjectileSequence: slice.nextProjectileSequence,
  };
}
