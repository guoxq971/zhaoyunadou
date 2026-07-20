import {
  classifyTransfer,
  boardPieceAt,
  commitAtomicTransfer,
  commitMergeOccupancy,
  inspectTransfer,
  itemAtLocation as boardItemAtLocation,
  recordBoardTransfer,
  replaceBoardOccupants,
  transferDomainEvent,
} from '../board/index.js';
import {
  createHeroParts,
  ensurePieceIdentity,
  isMovablePiece,
  matchesPieceExpectation,
  pieceSignature,
  pieceUpgradedDomainEvent,
  retirePiece,
  setPieceLocation,
  upgradePiece,
} from '../piece/index.js';
import { registerUnlockedHero } from '../skill-status/index.js';
import { publishDomainEventFor, runtimeFor } from '../../engine-core/public.js';
import {
  canMerge,
  configForEconomy,
  detectHero,
  detectHeroOnBoard,
} from './rules.js';

export const isMovableUnit = isMovablePiece;
export const itemSignature = pieceSignature;
const tickFor = (state, tick) => tick ?? runtimeFor(state)?.currentTick?.() ?? 0;
function resolveBenchLocation(state, location) {
  if (location?.zone !== 'bench') return null;
  const index = Number(location.index);
  if (!Number.isInteger(index) || index < 0 || index >= state.bench.length) return null;
  return {
    zone: 'bench', index,
    get: () => state.bench[index],
    set: (value) => { state.bench[index] = value; },
  };
}

const optionsFor = (state, gamePack) => ({
  canCombine: (target, source) => canMerge(target, source, gamePack),
  // Board 负责原子事务，Economy 只授予访问营栏单个位置的窄口。
  resolveExternalLocation: (location) => resolveBenchLocation(state, location),
});

export function classifyUnitTransfer(state, command, gamePack) {
  return classifyTransfer(state, command, optionsFor(state, gamePack));
}

export function insertBenchPiece(state, piece) {
  const index = state.bench.findIndex((entry) => entry === null);
  if (index < 0) return { ok: false, reason: 'bench-full' };
  ensurePieceIdentity(state, piece, { zone: 'bench', index });
  state.bench[index] = piece;
  return { ok: true, reason: 'none', index, piece };
}

export function relocateBenchPiece(state, { sourceIndex, targetIndex, expectedSource, accepts = () => true }) {
  const source = Number(sourceIndex);
  const target = Number(targetIndex);
  if (!Number.isInteger(source) || source < 0 || source >= state.bench.length) return { ok: false, reason: 'invalid-source' };
  if (!Number.isInteger(target) || target < 0 || target >= state.bench.length) return { ok: false, reason: 'invalid-target' };
  if (source === target) return { ok: false, reason: 'same-location' };
  const piece = state.bench[source];
  if (!piece || !accepts(piece)) return { ok: false, reason: 'source-not-movable' };
  if (state.bench[target]) return { ok: false, reason: 'target-not-empty' };
  if (expectedSource !== undefined && !matchesPieceExpectation(piece, expectedSource)) {
    return { ok: false, reason: 'source-changed' };
  }
  state.bench[source] = null;
  state.bench[target] = piece;
  setPieceLocation(piece, { zone: 'bench', index: target });
  return { ok: true, reason: 'none', action: 'move', piece, sourceIndex: source, targetIndex: target };
}

export function removeBenchPiece(state, index, { accepts = () => true } = {}) {
  const slot = Number(index);
  if (!Number.isInteger(slot) || slot < 0 || slot >= state.bench.length) return { ok: false, reason: 'invalid-source' };
  const piece = state.bench[slot];
  if (!piece || !accepts(piece)) return { ok: false, reason: 'source-not-movable' };
  state.bench[slot] = null;
  return { ok: true, reason: 'none', piece, index: slot };
}

export function applyUnitTransfer(state, command, gamePack, tick) {
  const plan = inspectTransfer(state, command, optionsFor(state, gamePack));
  if (!plan.ok) return plan;
  ensurePieceIdentity(state, plan.sourceItem, command.source);
  if (plan.targetItem) ensurePieceIdentity(state, plan.targetItem, command.target);
  const committed = plan.action === 'merge' ? commitMergeOccupancy(plan) : commitAtomicTransfer(plan);
  if (!committed.ok) return committed;
  const eventTick = tickFor(state, tick);
  if (plan.action === 'merge') {
    upgradePiece(plan.targetItem);
    state.stats.merges++;
    publishDomainEventFor(state, pieceUpgradedDomainEvent(plan.targetItem, eventTick));
    publishDomainEventFor(state, {
      type: 'formation.merged', source: 'economy-formation', tick: eventTick,
      payload: {
        pieceId: plan.targetItem.pieceId,
        itemKind: plan.targetItem.kind,
        itemId: plan.targetItem.type ?? plan.targetItem.char,
        level: plan.targetItem.level,
        cell: plan.target.zone === 'grid' ? { r: plan.target.r, c: plan.target.c } : null,
      },
    });
  } else publishDomainEventFor(state, transferDomainEvent(plan, eventTick));
  return {
    ok: true,
    reason: 'none',
    action: plan.action,
    source: command.source,
    target: command.target,
    itemKind: plan.sourceItem.kind,
    itemId: plan.sourceItem.type ?? plan.sourceItem.char,
    pieceId: plan.action === 'merge' ? plan.targetItem.pieceId : plan.sourceItem.pieceId,
    level: plan.action === 'merge' ? plan.targetItem.level : plan.sourceItem.level ?? 1,
  };
}

export function unlockHero(state, { key, r, c, level = 1 }, gamePack) {
  const config = configForEconomy(gamePack ?? state);
  const consumed = [boardPieceAt(state, r, c), boardPieceAt(state, r, c + 1)];
  consumed.forEach((piece, index) => ensurePieceIdentity(state, piece, {
    zone: 'grid', r, c: c + index,
  }));
  const [left, right] = createHeroParts(state, key, level, [
    { zone: 'grid', r, c },
    { zone: 'grid', r, c: c + 1 },
  ]);
  const replaced = replaceBoardOccupants(state, [
    { r, c, expected: boardPieceAt(state, r, c), next: left },
    { r, c: c + 1, expected: boardPieceAt(state, r, c + 1), next: right },
  ]);
  if (!replaced.ok) throw new Error(`[economy] hero board replacement failed: ${replaced.reason}`);
  consumed.forEach(retirePiece);
  const hero = config.heroes[key];
  registerUnlockedHero(state, {
    key, r, c, level, cd: 0,
    ultCd: hero.ultCd * (hero.initialUltCooldownRatio ?? 0.5),
  });
  publishDomainEventFor(state, {
    type: 'formation.hero_unlocked', source: 'economy-formation', tick: tickFor(state),
    payload: { heroId: key, r, c, level },
  });
  return { key, r, c, level };
}

export function itemAtLocation(state, location) {
  return boardItemAtLocation(state, location, optionsFor(state));
}

export { detectHero, detectHeroOnBoard, recordBoardTransfer };
