import {
  isMovablePiece,
  matchesPieceExpectation,
  retirePiece,
  setPieceLocation,
} from '../piece/index.js';

export const BOARD_API_VERSION = '1.0.0';

const asCell = (value) => Array.isArray(value)
  ? { r: value[0], c: value[1] }
  : { r: value.r, c: value.c };
const rotate180 = ({ r, c }, rows, cols) => ({ r: rows - 1 - r, c: cols - 1 - c });

function mapDefinition(gamePack, mapId) {
  const maps = gamePack?.manifests?.levels?.maps;
  if (Array.isArray(maps)) return maps.find((map) => map.id === mapId) ?? maps[0];
  if (maps && typeof maps === 'object') return maps[mapId] ?? Object.values(maps)[0];
  return null;
}

export function buildBoard(gamePack, mapId) {
  const board = gamePack?.config?.board;
  if (!board) throw new TypeError('[board] gamePack.config.board is required');
  const { cols, rows } = board;
  const grid = Array.from({ length: rows }, () => (
    Array.from({ length: cols }, () => ({ type: 'locked', unit: null }))
  ));
  const definition = mapDefinition(gamePack, mapId);
  const declaredLanes = definition?.lanes;
  if (!Array.isArray(declaredLanes) || declaredLanes.length === 0) {
    throw new Error(`[board] map "${mapId ?? 'default'}" must declare lanes`);
  }
  let paths = declaredLanes.map((lane) => (
    Array.isArray(lane) ? lane.map(asCell) : lane.cells.map(asCell)
  ));
  if (paths.length === 1 && (definition?.symmetry ?? 'rotate-180') === 'rotate-180') {
    paths = [...paths, paths[0].map((cell) => rotate180(cell, rows, cols))];
  }
  paths.forEach((path, lane) => path.forEach(({ r, c }) => {
    grid[r][c].type = 'path';
    grid[r][c].lane = lane;
  }));
  for (const [lane, path] of paths.entries()) {
    const start = path[0];
    const end = path.at(-1);
    grid[start.r][start.c].decoration = 'bramble';
    grid[end.r][end.c].type = 'gate';
    grid[end.r][end.c].lane = lane;
  }
  const openCells = definition.openCells ?? [];
  for (const value of openCells) {
    const { r, c } = asCell(value);
    grid[r][c].type = 'open';
  }
  const legacyLane = Math.min(definition?.legacyPathLane ?? 0, paths.length - 1);
  return { grid, paths, path: paths[Math.max(0, legacyLane)] };
}

export const cellAt = (grid, row, column) => (
  row >= 0 && row < grid.length && column >= 0 && column < grid[0].length
    ? grid[row][column]
    : null
);

function resolveLocation(state, location) {
  if (location?.zone === 'bench') {
    const index = Number(location.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.bench.length) return null;
    return { zone: 'bench', index, get: () => state.bench[index], set: (value) => { state.bench[index] = value; } };
  }
  if (location?.zone === 'grid') {
    const r = Number(location.r);
    const c = Number(location.c);
    const cell = Number.isInteger(r) && Number.isInteger(c) ? state.grid[r]?.[c] : null;
    if (!cell) return null;
    return { zone: 'grid', r, c, cell, get: () => cell.unit, set: (value) => { cell.unit = value; } };
  }
  return null;
}

const sameLocation = (source, target) => source.zone === target.zone && (
  source.zone === 'bench'
    ? source.index === target.index
    : source.r === target.r && source.c === target.c
);
const failure = (reason) => ({ ok: false, reason });

export function inspectTransfer(state, command, { canCombine = () => false } = {}) {
  const source = resolveLocation(state, command?.source);
  if (!source) return failure('invalid-source');
  const sourceItem = source.get();
  if (!sourceItem) return failure('source-empty');
  if (!isMovablePiece(sourceItem)) return failure('source-not-movable');
  if (!matchesPieceExpectation(sourceItem, command.expectedSource)) return failure('source-changed');
  const target = resolveLocation(state, command?.target);
  if (!target) return failure('invalid-target');
  if (sameLocation(source, target)) return failure('same-location');
  if (source.zone === 'grid' && source.cell.type !== 'open') return failure('source-not-open');
  if (target.zone === 'grid' && target.cell.type !== 'open') return failure('target-not-open');
  const targetItem = target.get();
  if (targetItem && !isMovablePiece(targetItem)) return failure('target-not-movable');
  const action = target.zone === 'grid' && targetItem && canCombine(targetItem, sourceItem)
    ? 'merge'
    : targetItem ? 'swap' : 'move';
  return { ok: true, reason: 'none', action, source, target, sourceItem, targetItem };
}

function unchanged(plan) {
  return plan.source.get() === plan.sourceItem && plan.target.get() === plan.targetItem;
}

export function commitAtomicTransfer(plan) {
  if (!plan?.ok || !['move', 'swap'].includes(plan.action)) return failure('invalid-transfer-plan');
  if (!unchanged(plan)) return failure('source-changed');
  plan.source.set(plan.targetItem ?? null);
  plan.target.set(plan.sourceItem);
  setPieceLocation(plan.sourceItem, publicLocation(plan.target));
  if (plan.targetItem) setPieceLocation(plan.targetItem, publicLocation(plan.source));
  return { ok: true, reason: 'none', action: plan.action };
}

export function commitMergeOccupancy(plan) {
  if (!plan?.ok || plan.action !== 'merge') return failure('invalid-transfer-plan');
  if (!unchanged(plan)) return failure('source-changed');
  plan.source.set(null);
  retirePiece(plan.sourceItem);
  return { ok: true, reason: 'none', action: 'merge' };
}

function publicLocation(location) {
  return location.zone === 'bench'
    ? { zone: 'bench', index: location.index }
    : { zone: 'grid', r: location.r, c: location.c };
}

export function classifyTransfer(state, command, options) {
  const plan = inspectTransfer(state, command, options);
  return plan.ok ? { ok: true, reason: 'none', action: plan.action } : plan;
}

export function itemAtLocation(state, location) {
  return resolveLocation(state, location)?.get() ?? null;
}

export function transferDomainEvent(plan, tick) {
  if (!plan?.ok || !['move', 'swap'].includes(plan.action)) return null;
  return {
    type: plan.action === 'swap' ? 'board.pieces_swapped' : 'board.piece_moved',
    source: 'board-route',
    tick,
    payload: {
      pieceId: plan.sourceItem.pieceId,
      otherPieceId: plan.targetItem?.pieceId ?? null,
      source: publicLocation(plan.source),
      target: publicLocation(plan.target),
    },
  };
}
