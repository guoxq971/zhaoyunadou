import {
  classifyTransfer,
  commitAtomicTransfer,
  commitMergeOccupancy,
  inspectTransfer,
  itemAtLocation,
  transferDomainEvent,
} from '../board/index.js';
import {
  createHeroParts,
  ensurePieceIdentity,
  isMovablePiece,
  matchesPieceExpectation,
  pieceSignature,
  pieceUpgradedDomainEvent,
  setPieceLocation,
  upgradePiece,
} from '../piece/index.js';
import { eventsFor, publishDomainEventFor, runtimeFor } from '../../engine-core/public.js';
import { canMerge, configForEconomy, detectHero } from './rules.js';

export const isMovableUnit = isMovablePiece;
export const itemSignature = pieceSignature;
const tickFor = (state, tick) => tick ?? runtimeFor(state)?.currentTick?.() ?? 0;
const optionsFor = (gamePack) => ({ canCombine: (target, source) => canMerge(target, source, gamePack) });

export function classifyUnitTransfer(state, command, gamePack) {
  return classifyTransfer(state, command, optionsFor(gamePack));
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
  const plan = inspectTransfer(state, command, optionsFor(gamePack));
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
      payload: { pieceId: plan.targetItem.pieceId, level: plan.targetItem.level },
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
    level: plan.action === 'merge' ? plan.targetItem.level : plan.sourceItem.level ?? 1,
  };
}

export function unlockHero(state, { key, r, c, level = 1 }, gamePack) {
  const config = configForEconomy(gamePack ?? state);
  const [left, right] = createHeroParts(state, key, level, [
    { zone: 'grid', r, c },
    { zone: 'grid', r, c: c + 1 },
  ]);
  state.grid[r][c].unit = left;
  state.grid[r][c + 1].unit = right;
  const hero = config.heroes[key];
  state.heroes.push({
    key, r, c, level, cd: 0,
    ultCd: hero.ultCd * (hero.initialUltCooldownRatio ?? 0.5),
  });
  state.lastHeroUnlocked = key;
  if (state.stats) state.stats.heroUnlocks = (state.stats.heroUnlocks ?? 0) + 1;
  eventsFor(state)?.emit('hero_unlock', state, {
    result: 'success', reason: 'pair-completed', heroId: key,
  });
  publishDomainEventFor(state, {
    type: 'formation.hero_unlocked', source: 'economy-formation', tick: tickFor(state),
    payload: { heroId: key, r, c, level },
  });
  return { key, r, c, level };
}

export { detectHero, itemAtLocation };
