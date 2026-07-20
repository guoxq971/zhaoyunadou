// 可测试的玩家动作：征兵与被中断拖拽的恢复。
import { ownedFragChars, recruitCost, rollGacha } from './logic.js';
import { eventsFor, gamePackFor } from './engine-core/runtime-context.js';

export const canStartDrag = (drag, button) =>
  !drag?.item && (button === undefined || button === 0);

export function attemptRecruit(state, rand = Math.random, drag = null) {
  const gamePack = gamePackFor(state);
  const events = eventsFor(state);
  const cost = recruitCost(state.recruitCount, gamePack);
  events?.emit('recruit_attempt', state, { result: 'attempted', reason: 'none', cost });
  const failed = (reason) => {
    const result = { ok: false, reason, cost };
    events?.emit('recruit_result', state, { result: 'failure', reason, cost });
    events?.emit('invalid_action', state, { result: 'failure', reason, actionId: 'recruit' });
    return result;
  };
  // 营栏起拖会暂时留下空槽；此时征兵会抢占保留槽并造成原字牌丢失。
  if (drag?.item) return failed('drag-active');
  const slot = state.bench.findIndex((item) => item === null);
  if (slot < 0) return failed('bench-full');
  if (state.mantou < cost) return failed('insufficient-mantou');

  // 五关各自提供一次双字保底；队列耗尽后恢复完整随机池。
  const queuedChar = state.recruitQueue?.[0];
  const got = queuedChar
    ? { kind: 'frag', char: queuedChar, level: 1 }
    : rollGacha(rand, ownedFragChars(state), gamePack);
  state.mantou -= cost;
  state.recruitCount++;
  state.stats.recruits++;
  if (queuedChar) state.recruitQueue.shift();
  if (got.kind === 'shovel') state.shovels++;
  state.bench[slot] = got;
  events?.emit('recruit_result', state, {
    result: 'success', reason: 'none', cost, itemKind: got.kind, itemId: got.type ?? got.char ?? 'shovel', slot,
  });
  return { ok: true, got, slot, cost };
}

export function attemptBatchRecruit(state, rand = Math.random, drag = null) {
  const gamePack = gamePackFor(state);
  const events = eventsFor(state);
  const results = [];
  let totalCost = 0;
  const failWithoutDraw = (reason) => {
    const nextCost = recruitCost(state.recruitCount, gamePack);
    events?.emit('invalid_action', state, {
      result: 'failure', reason, actionId: 'batch-recruit',
    });
    return {
      ok: false, reason, stopReason: reason,
      filledCount: 0, totalCost: 0, nextCost, results,
    };
  };

  if (drag?.item) return failWithoutDraw('drag-active');
  const capacity = state.bench.filter((item) => item === null).length;
  if (capacity === 0) return failWithoutDraw('bench-full');
  if (state.mantou < recruitCost(state.recruitCount, gamePack)) {
    return failWithoutDraw('insufficient-mantou');
  }

  // 循环上限固定为命令开始时的空槽数；每一抽继续走原单抽逻辑和事件链。
  for (let index = 0; index < capacity; index++) {
    if (!state.bench.some((item) => item === null)) break;
    if (state.mantou < recruitCost(state.recruitCount, gamePack)) break;
    const result = attemptRecruit(state, rand, null);
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
