import {
  createRegistry,
  gamePackFor,
  publishDomainEventFor,
  runtimeFor,
} from '../../engine-core/public.js';
import { boardPieceAt, openLockedCell } from '../board/index.js';
import {
  detectHeroOnBoard,
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

export function recordRecruitedItem(state, piece) {
  if (piece?.kind !== 'shovel') return { recorded: false, itemId: null };
  state.shovels++;
  return { recorded: true, itemId: 'shovel', count: state.shovels };
}

export function commitShovelUse(state, row, column, tick) {
  if (state.shovels <= 0) return { ok: false, reason: 'tool-unavailable' };
  const result = openLockedCell(state, row, column, tickFor(state, tick));
  if (!result.ok) return result;
  state.shovels--;
  if (state.stats) state.stats.shovelsUsed = (state.stats.shovelsUsed ?? 0) + 1;
  return {
    ok: true,
    reason: 'none',
    row,
    column,
    tick: tickFor(state, tick),
    boardEvent: result.event,
  };
}

export function publishCommittedShovelUse(state, committed, source = 'bench') {
  if (!committed?.ok) return false;
  publishDomainEventFor(state, committed.boardEvent);
  publish(state, 'item.used', {
    itemId: 'shovel', r: committed.row, c: committed.column, source,
  }, committed.tick);
  return true;
}

// 旧同步 API 保持 boolean；GameCommand 路径则将发布延后到营栏与库存全部提交后。
export function useShovel(state, row, column, tick) {
  const committed = commitShovelUse(state, row, column, tick);
  if (!committed.ok) return false;
  publishCommittedShovelUse(state, committed, 'bench');
  return true;
}

export function useBrush(state, row, column, tick, gamePack) {
  const piece = boardPieceAt(state, row, column);
  if (!piece || !['troop', 'frag'].includes(piece.kind) || state.brushes <= 0) return false;
  const config = gamePack?.config ?? gamePackFor(state)?.config;
  const featured = config?.heroes?.[state.stage.featuredHero];
  if (!featured) return false;
  const [first, second] = featured.chars;
  const owned = ownedFragChars(state).filter((char, index, chars) => {
    if (piece.kind !== 'frag' || char !== piece.char) return true;
    return index !== chars.indexOf(char);
  });
  const char = owned.includes(first) && !owned.includes(second)
    ? second
    : owned.includes(second) && !owned.includes(first) ? first : first;
  ensurePieceIdentity(state, piece, { zone: 'grid', r: row, c: column });
  transformPiece(piece, { kind: 'frag', char, level: 1 });
  state.brushes--;
  if (state.stats) state.stats.brushUses = (state.stats.brushUses ?? 0) + 1;
  publish(state, 'item.used', { itemId: 'brush', r: row, c: column, char }, tick);
  return { char, hero: detectHeroOnBoard(state, row, column, gamePack ?? gamePackFor(state)) };
}

export function insertGeneratedShovel(state, tick) {
  const result = insertBenchPiece(state, { kind: 'shovel' });
  if (!result.ok) return result;
  recordRecruitedItem(state, result.piece);
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
