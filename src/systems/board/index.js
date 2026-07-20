import {
  isMovablePiece,
  matchesPieceExpectation,
  readPiece,
  retirePiece,
  setPieceLocation,
} from '../piece/index.js';
import { getStateSlice } from '../../engine-core/public.js';

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

export function createBoardStateSlice(gamePack, mapId) {
  return {
    ...buildBoard(gamePack, mapId),
    stats: { moves: 0, swaps: 0 },
  };
}

export const cellAt = (grid, row, column) => (
  row >= 0 && row < grid.length && column >= 0 && column < grid[0].length
    ? grid[row][column]
    : null
);

export function boardPieceAt(state, row, column) {
  return cellAt(state.grid, row, column)?.unit ?? null;
}

export function boardCellType(state, row, column) {
  return cellAt(state.grid, row, column)?.type ?? null;
}

export function listBoardOccupants(state, { kind = null } = {}) {
  const occupants = [];
  for (let row = 0; row < state.grid.length; row++) {
    for (let column = 0; column < state.grid[row].length; column++) {
      const piece = state.grid[row][column].unit;
      if (!piece || (kind !== null && piece.kind !== kind)) continue;
      occupants.push(Object.freeze({ row, column, piece: readPiece(piece) }));
    }
  }
  return Object.freeze(occupants);
}

export function routeForEntity(state, entity) {
  const routes = Array.isArray(state.paths) && state.paths.length > 0
    ? state.paths
    : Array.isArray(state.path) ? [state.path] : [];
  return routes[entity?.lane ?? 0] ?? routes[0] ?? [];
}

export function routeEndProgress(state, entity) {
  return Math.max(-1, routeForEntity(state, entity).length - 1);
}

// 规则坐标不叠加 bob/抖动，保证纯表现随机不会改变索敌与命中。
export function routePosition(state, entity, cellXY) {
  const route = routeForEntity(state, entity);
  if (route.length === 0) return { x: 0, y: 0 };
  if (route.length === 1) return cellXY(route[0].r, route[0].c);
  const index = Math.max(0, Math.min(Math.floor(entity?.p ?? 0), route.length - 2));
  const fraction = Math.max(0, Math.min((entity?.p ?? 0) - index, 1));
  const first = cellXY(route[index].r, route[index].c);
  const second = cellXY(route[index + 1].r, route[index + 1].c);
  return {
    x: first.x + (second.x - first.x) * fraction,
    y: first.y + (second.y - first.y) * fraction,
  };
}

export function openLockedCell(state, row, column, tick = 0) {
  const cell = cellAt(state.grid, row, column);
  if (!cell) return { ok: false, reason: 'invalid-target' };
  if (cell.type !== 'locked') return { ok: false, reason: 'target-not-locked' };
  cell.type = 'open';
  return {
    ok: true,
    reason: 'none',
    event: {
      type: 'board.cell_opened', source: 'board-route', tick,
      payload: { r: row, c: column },
    },
  };
}

function resolveLocation(state, location, resolveExternalLocation) {
  if (location?.zone === 'grid') {
    const r = Number(location.r);
    const c = Number(location.c);
    const cell = Number.isInteger(r) && Number.isInteger(c) ? state.grid[r]?.[c] : null;
    if (!cell) return null;
    return { zone: 'grid', r, c, cell, get: () => cell.unit, set: (value) => { cell.unit = value; } };
  }
  const external = resolveExternalLocation?.(location) ?? null;
  if (!external) return null;
  if (typeof external.get !== 'function' || typeof external.set !== 'function') {
    throw new TypeError('[board] external location must expose get/set functions');
  }
  return external;
}

const sameLocation = (source, target) => source.zone === target.zone && (
  source.zone === 'bench'
    ? source.index === target.index
    : source.r === target.r && source.c === target.c
);
const failure = (reason) => ({ ok: false, reason });

export function inspectTransfer(state, command, {
  canCombine = () => false,
  resolveExternalLocation = null,
} = {}) {
  const source = resolveLocation(state, command?.source, resolveExternalLocation);
  if (!source) return failure('invalid-source');
  const sourceItem = source.get();
  if (!sourceItem) return failure('source-empty');
  if (!isMovablePiece(sourceItem)) return failure('source-not-movable');
  if (!matchesPieceExpectation(sourceItem, command.expectedSource)) return failure('source-changed');
  const target = resolveLocation(state, command?.target, resolveExternalLocation);
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

export function itemAtLocation(state, location, { resolveExternalLocation = null } = {}) {
  return resolveLocation(state, location, resolveExternalLocation)?.get() ?? null;
}

// Board 拥有格子占用；多格替换先完整校验，再一次提交。
export function replaceBoardOccupants(state, replacements) {
  if (!Array.isArray(replacements) || replacements.length === 0) {
    return failure('invalid-replacements');
  }
  const seen = new Set();
  const plan = [];
  for (const replacement of replacements) {
    const r = Number(replacement?.r);
    const c = Number(replacement?.c);
    const key = `${r}:${c}`;
    const cell = Number.isInteger(r) && Number.isInteger(c) ? state.grid[r]?.[c] : null;
    if (!cell) return failure('invalid-target');
    if (seen.has(key)) return failure('duplicate-target');
    if (Object.hasOwn(replacement, 'expected') && cell.unit !== replacement.expected) {
      return failure('source-changed');
    }
    seen.add(key);
    plan.push({ cell, next: replacement.next ?? null });
  }
  for (const { cell, next } of plan) cell.unit = next;
  return { ok: true, reason: 'none', count: plan.length };
}

export function restoreBoardPiece(state, location, piece) {
  const r = Number(location?.r);
  const c = Number(location?.c);
  const cell = Number.isInteger(r) && Number.isInteger(c) ? state.grid[r]?.[c] : null;
  if (!cell) return failure('invalid-target');
  if (cell.unit) return failure('target-occupied');
  cell.unit = piece;
  return { ok: true, reason: 'none', destination: 'board', r, c };
}

function boardStateFor(state) {
  try { return getStateSlice(state, 'board'); }
  catch { return state; }
}

export function recordBoardTransfer(state, action) {
  if (!['move', 'swap'].includes(action)) return { ok: false, reason: 'unknown-transfer-action' };
  const board = boardStateFor(state);
  board.stats ??= {};
  const key = action === 'move' ? 'moves' : 'swaps';
  board.stats[key] = (board.stats[key] ?? 0) + 1;
  return { ok: true, reason: 'none', action, count: board.stats[key] };
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
      itemKind: plan.sourceItem.kind,
      itemId: plan.sourceItem.type ?? plan.sourceItem.char,
      source: publicLocation(plan.source),
      target: publicLocation(plan.target),
    },
  };
}
