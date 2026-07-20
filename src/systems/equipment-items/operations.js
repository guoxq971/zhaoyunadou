import {
  createRegistry,
  gamePackFor,
  publishDomainEventFor,
  runtimeFor,
} from '../../engine-core/public.js';
import { cellAt, openLockedCell } from '../board/index.js';
import {
  detectHero,
  insertBenchPiece,
  ownedFragChars,
  relocateBenchPiece,
  removeBenchPiece,
} from '../economy/index.js';
import { ensurePieceIdentity, transformPiece } from '../piece/index.js';

const tickFor = (state, tick) => tick ?? runtimeFor(state)?.currentTick?.() ?? 0;

function publish(state, type, payload, tick) {
  publishDomainEventFor(state, {
    type,
    source: 'equipment-items',
    tick: tickFor(state, tick),
    payload,
  });
}

export function useShovel(state, row, column, tick) {
  if (state.shovels <= 0) return false;
  const result = openLockedCell(state, row, column, tickFor(state, tick));
  if (!result.ok) return false;
  state.shovels--;
  if (state.stats) state.stats.shovelsUsed = (state.stats.shovelsUsed ?? 0) + 1;
  publishDomainEventFor(state, result.event);
  publish(state, 'item.used', { itemId: 'shovel', r: row, c: column }, tick);
  return true;
}

export function useBrush(state, row, column, tick, gamePack) {
  const cell = cellAt(state.grid, row, column);
  if (!cell?.unit || !['troop', 'frag'].includes(cell.unit.kind) || state.brushes <= 0) return false;
  const config = gamePack?.config ?? gamePackFor(state)?.config;
  const featured = config?.heroes?.[state.stage.featuredHero];
  if (!featured) return false;
  const [first, second] = featured.chars;
  const owned = ownedFragChars(state).filter((char, index, chars) => {
    if (cell.unit.kind !== 'frag' || char !== cell.unit.char) return true;
    return index !== chars.indexOf(char);
  });
  const char = owned.includes(first) && !owned.includes(second)
    ? second
    : owned.includes(second) && !owned.includes(first) ? first : first;
  ensurePieceIdentity(state, cell.unit, { zone: 'grid', r: row, c: column });
  transformPiece(cell.unit, { kind: 'frag', char, level: 1 });
  state.brushes--;
  if (state.stats) state.stats.brushUses = (state.stats.brushUses ?? 0) + 1;
  publish(state, 'item.used', { itemId: 'brush', r: row, c: column, char }, tick);
  return { char, hero: detectHero(state.grid, row, column, gamePack ?? gamePackFor(state)) };
}

export function insertGeneratedShovel(state, tick) {
  const result = insertBenchPiece(state, { kind: 'shovel' });
  if (!result.ok) return result;
  state.shovels++;
  publish(state, 'item.generated', { itemId: 'shovel', slot: result.index }, tick);
  return { ok: true, reason: 'none', slot: result.index };
}

export function updateLuoyangShovel(state, dt, tick) {
  const tool = state.luoyang;
  if (!tool?.enabled || dt <= 0) return null;
  tool.elapsed += dt;
  if (tool.elapsed < tool.interval) return null;
  const result = insertGeneratedShovel(state, tick);
  if (!result.ok) {
    tool.elapsed = tool.interval;
    tool.pending = true;
    return result;
  }
  tool.elapsed -= tool.interval;
  tool.pending = false;
  tool.generated++;
  if (state.stats) state.stats.luoyangGenerated = (state.stats.luoyangGenerated ?? 0) + 1;
  return { ...result, generated: tool.generated };
}

export function relocateShovel(state, { source, target, expectedSource }) {
  if (source?.zone !== 'bench') return { ok: false, reason: 'source-not-movable' };
  const result = relocateBenchPiece(state, {
    sourceIndex: source.index,
    targetIndex: target?.zone === 'bench' ? target.index : Number.NaN,
    expectedSource,
    accepts: (piece) => piece.kind === 'shovel',
  });
  if (!result.ok) return result;
  return {
    ok: true, reason: 'none', action: 'move', itemId: 'shovel', source,
    target: { zone: 'bench', index: result.targetIndex },
  };
}

export function consumeShovelFromBench(state, preferredIndex) {
  const index = Number.isInteger(preferredIndex)
    ? preferredIndex
    : state.bench.findIndex((entry) => entry?.kind === 'shovel');
  return removeBenchPiece(state, index, { accepts: (piece) => piece.kind === 'shovel' });
}

export const ITEM_REGISTRY = createRegistry('item', {
  'item.open-locked-cell': Object.freeze({ id: 'shovel', use: useShovel }),
  'item.rewrite-featured-hero-char': Object.freeze({ id: 'brush', use: useBrush }),
  'item.periodic-generator': Object.freeze({ id: 'luoyang-shovel', update: updateLuoyangShovel }),
});
