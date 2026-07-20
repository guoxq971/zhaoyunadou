import {
  eventsFor,
  gamePackFor,
  publishDomainEventFor,
  runtimeFor,
} from '../../engine-core/public.js';
import { ensurePieceIdentity } from '../piece/index.js';
import { ownedFragChars, recruitCost, rollGacha } from './rules.js';

const tickFor = (state) => runtimeFor(state)?.currentTick?.() ?? 0;

function publish(state, type, payload) {
  publishDomainEventFor(state, {
    type,
    source: 'economy-formation',
    tick: tickFor(state),
    payload,
  });
}

export function attemptRecruit(state, random, drag = null) {
  const draw = random ?? (() => { throw new TypeError('[economy] deterministic random source is required'); });
  const gamePack = gamePackFor(state);
  const telemetry = eventsFor(state);
  const cost = recruitCost(state.recruitCount, gamePack);
  telemetry?.emit('recruit_attempt', state, { result: 'attempted', reason: 'none', cost });
  publish(state, 'economy.recruit_attempted', { cost, recruitIndex: state.recruitCount });
  const failed = (reason) => {
    telemetry?.emit('recruit_result', state, { result: 'failure', reason, cost });
    telemetry?.emit('invalid_action', state, { result: 'failure', reason, actionId: 'recruit' });
    publish(state, 'economy.recruit_completed', {
      ok: false, reason, cost, recruitIndex: state.recruitCount,
    });
    return { ok: false, reason, cost };
  };
  if (drag?.item) return failed('drag-active');
  const slot = state.bench.findIndex((item) => item === null);
  if (slot < 0) return failed('bench-full');
  if (state.mantou < cost) return failed('insufficient-mantou');

  const queuedChar = state.recruitQueue?.[0];
  const piece = queuedChar
    ? { kind: 'frag', char: queuedChar, level: 1 }
    : rollGacha(draw, ownedFragChars(state), gamePack);
  ensurePieceIdentity(state, piece, { zone: 'bench', index: slot });
  state.mantou -= cost;
  state.recruitCount++;
  state.stats.recruits++;
  if (queuedChar) state.recruitQueue.shift();
  if (piece.kind === 'shovel') state.shovels++;
  state.bench[slot] = piece;
  const itemId = piece.type ?? piece.char ?? 'shovel';
  telemetry?.emit('recruit_result', state, {
    result: 'success', reason: 'none', cost, itemKind: piece.kind, itemId, slot,
  });
  publish(state, 'economy.recruit_completed', {
    ok: true, reason: 'none', cost, itemKind: piece.kind, itemId, slot,
  });
  return { ok: true, got: piece, slot, cost };
}

export function attemptBatchRecruit(state, random, drag = null) {
  const gamePack = gamePackFor(state);
  const telemetry = eventsFor(state);
  const results = [];
  let totalCost = 0;
  const failWithoutDraw = (reason) => {
    const nextCost = recruitCost(state.recruitCount, gamePack);
    telemetry?.emit('invalid_action', state, { result: 'failure', reason, actionId: 'batch-recruit' });
    return {
      ok: false, reason, stopReason: reason,
      filledCount: 0, totalCost: 0, nextCost, results,
    };
  };

  if (drag?.item) return failWithoutDraw('drag-active');
  const capacity = state.bench.filter((item) => item === null).length;
  if (capacity === 0) return failWithoutDraw('bench-full');
  if (state.mantou < recruitCost(state.recruitCount, gamePack)) return failWithoutDraw('insufficient-mantou');

  for (let index = 0; index < capacity; index++) {
    if (!state.bench.some((item) => item === null)) break;
    if (state.mantou < recruitCost(state.recruitCount, gamePack)) break;
    const result = attemptRecruit(state, random, null);
    if (!result.ok) break;
    results.push(result);
    totalCost += result.cost;
  }
  const stopReason = state.bench.some((item) => item === null)
    ? 'insufficient-mantou'
    : 'bench-full';
  return {
    ok: true,
    reason: 'none',
    stopReason,
    filledCount: results.length,
    totalCost,
    nextCost: recruitCost(state.recruitCount, gamePack),
    results,
  };
}

export const canStartDrag = (drag, button) => (
  !drag?.item && (button === undefined || button === 0)
);

export function restoreDrag(state, drag) {
  const item = drag.item;
  if (!item) return { ok: false, reason: 'empty-drag' };
  if (drag.from === 'bench' && state.bench[drag.index] === null) {
    state.bench[drag.index] = item;
    return { ok: true, destination: 'bench', index: drag.index };
  }
  const origin = drag.from === 'board' ? state.grid[drag.r]?.[drag.c] : null;
  if (origin && !origin.unit) {
    origin.unit = item;
    return { ok: true, destination: 'board', r: drag.r, c: drag.c };
  }
  const fallback = state.bench.findIndex((entry) => entry === null);
  if (fallback >= 0) {
    state.bench[fallback] = item;
    return { ok: true, destination: 'bench', index: fallback };
  }
  return { ok: false, reason: 'no-safe-destination' };
}
