// 可测试的玩家动作：征兵与被中断拖拽的恢复。
import { CONFIG } from './config.js';
import { ownedFragChars, recruitCost, rollGacha } from './logic.js';

export const canStartDrag = (drag, button) =>
  !drag?.item && (button === undefined || button === 0);

export function attemptRecruit(state, rand = Math.random, drag = null) {
  const cost = recruitCost(state.recruitCount);
  // 营栏起拖会暂时留下空槽；此时征兵会抢占保留槽并造成原字牌丢失。
  if (drag?.item) return { ok: false, reason: 'drag-active', cost };
  if (state.mantou < cost) return { ok: false, reason: 'insufficient-mantou', cost };

  const slot = state.bench.findIndex((item) => item === null);
  if (slot < 0) return { ok: false, reason: 'bench-full', cost };

  // 五关各自提供一次双字保底；队列耗尽后恢复完整随机池。
  const queuedChar = state.recruitQueue?.[0];
  const got = queuedChar
    ? { kind: 'frag', char: queuedChar, level: 1 }
    : rollGacha(rand, ownedFragChars(state));
  state.mantou -= cost;
  state.recruitCount++;
  state.stats.recruits++;
  if (queuedChar) state.recruitQueue.shift();
  if (got.kind === 'shovel') state.shovels++;
  state.bench[slot] = got;
  return { ok: true, got, slot, cost };
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
