import { canMerge } from '../../logic.js';

export const isMovableUnit = (item) => item?.kind === 'troop' || item?.kind === 'frag';

export function itemSignature(item) {
  if (!item) return 'empty';
  if (item.kind === 'troop') return `troop:${item.type}:${item.level ?? 1}`;
  if (item.kind === 'frag') return `frag:${item.char}:${item.level ?? 1}`;
  if (item.kind === 'hero') return `hero:${item.key}:${item.part ?? 0}:${item.level ?? 1}`;
  return String(item.kind ?? 'unknown');
}

function resolveLocation(state, location) {
  if (location?.zone === 'bench') {
    const index = Number(location.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.bench.length) return null;
    return {
      zone: 'bench', index,
      get: () => state.bench[index],
      set: (value) => { state.bench[index] = value; },
    };
  }
  if (location?.zone === 'grid') {
    const r = Number(location.r);
    const c = Number(location.c);
    const cell = Number.isInteger(r) && Number.isInteger(c) ? state.grid[r]?.[c] : null;
    if (!cell) return null;
    return {
      zone: 'grid', r, c, cell,
      get: () => cell.unit,
      set: (value) => { cell.unit = value; },
    };
  }
  return null;
}

const sameLocation = (source, target) => source.zone === target.zone && (
  source.zone === 'bench'
    ? source.index === target.index
    : source.r === target.r && source.c === target.c
);

function failure(reason) {
  return { ok: false, reason };
}

// 先解析并验证源、目标与反向落点，所有校验完成后才执行至多两次写入。
function inspectUnitTransfer(state, command, gamePack) {
  const source = resolveLocation(state, command?.source);
  if (!source) return failure('invalid-source');
  const sourceItem = source.get();
  if (!sourceItem) return failure('source-empty');
  if (!isMovableUnit(sourceItem)) return failure('source-not-movable');
  if (command.expectedSource !== undefined && command.expectedSource !== itemSignature(sourceItem)) {
    return failure('source-changed');
  }

  const target = resolveLocation(state, command?.target);
  if (!target) return failure('invalid-target');
  if (sameLocation(source, target)) return failure('same-location');
  if (source.zone === 'grid' && source.cell.type !== 'open') return failure('source-not-open');
  if (target.zone === 'grid' && target.cell.type !== 'open') return failure('target-not-open');

  const targetItem = target.get();
  if (targetItem && !isMovableUnit(targetItem)) return failure('target-not-movable');
  const action = target.zone === 'grid' && targetItem && canMerge(targetItem, sourceItem, gamePack)
    ? 'merge'
    : targetItem ? 'swap' : 'move';

  return { ok: true, reason: 'none', action, source, target, sourceItem, targetItem };
}

export function classifyUnitTransfer(state, command, gamePack) {
  const inspected = inspectUnitTransfer(state, command, gamePack);
  return inspected.ok
    ? { ok: true, reason: 'none', action: inspected.action }
    : inspected;
}

export function applyUnitTransfer(state, command, gamePack) {
  const inspected = inspectUnitTransfer(state, command, gamePack);
  if (!inspected.ok) return inspected;
  const { source, target, sourceItem, targetItem, action } = inspected;

  if (action === 'merge') {
    source.set(null);
    targetItem.level = (targetItem.level ?? 1) + 1;
    targetItem.flash = 0.2;
    state.stats.merges++;
  } else {
    source.set(targetItem ?? null);
    target.set(sourceItem);
  }

  return {
    ok: true,
    reason: 'none',
    action,
    source: command.source,
    target: command.target,
    itemKind: sourceItem.kind,
    itemId: sourceItem.type ?? sourceItem.char,
    level: action === 'merge' ? targetItem.level : sourceItem.level ?? 1,
  };
}

export function itemAtLocation(state, location) {
  return resolveLocation(state, location)?.get() ?? null;
}
