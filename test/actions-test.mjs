import assert from 'node:assert/strict';
import {
  attemptBatchRecruit,
  attemptRecruit,
  canStartDrag,
  restoreDrag,
} from '../src/actions.js';
import { createGame } from '../src/state.js';
import { updateLuoyangShovel } from '../src/field-tools.js';

{
  const state = createGame();
  state.mantou = 15;
  const before = JSON.stringify({
    mantou: state.mantou,
    bench: state.bench,
    recruitCount: state.recruitCount,
    stats: state.stats,
  });
  assert.deepEqual(attemptRecruit(state, () => 0), {
    ok: false,
    reason: 'insufficient-mantou',
    cost: 16,
  });
  assert.equal(JSON.stringify({
    mantou: state.mantou,
    bench: state.bench,
    recruitCount: state.recruitCount,
    stats: state.stats,
  }), before, '馒头不足时不可改变任何征兵状态');
}

{
  const state = createGame();
  state.bench = state.bench.map((item) => item ?? { kind: 'troop', type: 'dao', level: 1 });
  assert.deepEqual(attemptRecruit(state, () => 0), {
    ok: false,
    reason: 'bench-full',
    cost: 16,
  });
  assert.equal(state.mantou, 40, '营栏满时不可扣馒头');
}

{
  const state = createGame();
  state.recruitQueue = [];
  const result = attemptRecruit(state, () => 0);
  assert.equal(result.ok, true);
  assert.equal(result.got.type, 'dao');
  assert.equal(result.slot, 4);
  assert.equal(state.bench[4].type, 'dao');
  assert.equal(state.mantou, 24);
  assert.equal(state.recruitCount, 1);
  assert.equal(state.stats.recruits, 1);
}

{
  const state = createGame();
  state.recruitQueue = [];
  const originalRandom = Math.random;
  let randomCalls = 0;
  Math.random = () => {
    randomCalls++;
    return 0;
  };
  try {
    const result = attemptRecruit(state);
    assert.equal(result.ok, true, '旧单次征兵省略 random 时仍可使用 Math.random');
    assert.equal(result.got.type, 'dao');
    assert.equal(randomCalls, 1);
  } finally {
    Math.random = originalRandom;
  }
}

{
  const state = createGame();
  state.recruitQueue = [];
  state.bench.fill(null);
  state.mantou = 10_000;
  const originalRandom = Math.random;
  let randomCalls = 0;
  Math.random = () => {
    randomCalls++;
    return 0;
  };
  try {
    const result = attemptBatchRecruit(state);
    assert.equal(result.ok, true, '旧批量征兵省略 random 时仍可使用 Math.random');
    assert.equal(result.filledCount, state.bench.length);
    assert.equal(randomCalls, state.bench.length);
    assert.ok(state.bench.every((piece) => piece?.type === 'dao'));
  } finally {
    Math.random = originalRandom;
  }
}

{
  const state = createGame();
  state.recruitQueue = [];
  const result = attemptRecruit(state, () => 0.9999);
  assert.equal(result.ok, true);
  assert.equal(result.got.kind, 'shovel');
  assert.equal(state.shovels, 2);
  assert.equal(state.bench[result.slot].kind, 'shovel', '普通铲子应像实机一样进入营栏');
}

{
  const state = createGame(0, 0);
  const first = attemptRecruit(state, () => 0);
  assert.deepEqual(first.got, { kind: 'frag', char: '赵', level: 1 });
  state.bench[first.slot] = null; // 等价于玩家把「赵」部署到棋盘后腾出营位。
  const second = attemptRecruit(state, () => 0);
  assert.deepEqual(second.got, { kind: 'frag', char: '云', level: 1 });
  assert.deepEqual(state.recruitQueue, []);
}

{
  const state = createGame();
  assert.equal(updateLuoyangShovel(state, 59.9), null);
  const result = updateLuoyangShovel(state, 0.1);
  assert.equal(result.ok, true);
  assert.equal(state.bench[result.slot].kind, 'shovel');
  assert.equal(state.shovels, 2);
  assert.equal(state.stats.luoyangGenerated, 1);

  updateLuoyangShovel(state, 60);
  assert.equal(state.luoyang.pending, true, '营栏满时产物必须等待而不是丢失');
  state.bench[4] = null;
  const pending = updateLuoyangShovel(state, 0.01);
  assert.equal(pending.ok, true);
  assert.equal(state.stats.luoyangGenerated, 2);
}

{
  const state = createGame();
  const item = state.bench[0];
  state.bench[0] = null;
  assert.deepEqual(restoreDrag(state, { item, from: 'bench', index: 0 }), {
    ok: true,
    destination: 'bench',
    index: 0,
  });
  assert.equal(state.bench[0], item);
}

{
  const state = createGame();
  state.bench[3] = { kind: 'troop', type: 'dao', level: 1 };
  state.bench[4] = { kind: 'troop', type: 'qi', level: 1 };
  const item = state.bench[0];
  state.bench[0] = null;
  const drag = { item, from: 'bench', index: 0 };
  const beforeMantou = state.mantou;
  assert.deepEqual(attemptRecruit(state, () => 0, drag), {
    ok: false,
    reason: 'drag-active',
    cost: 16,
  });
  assert.equal(state.bench[0], null, '征兵不能占用拖拽中的保留槽');
  assert.equal(state.mantou, beforeMantou, '拖拽期间按 R 不应扣馒头');
  assert.equal(restoreDrag(state, drag).ok, true);
  assert.equal(state.bench[0], item, '松手后原字牌必须回到保留槽');
}

{
  assert.equal(canStartDrag({ item: null }, 0), true);
  assert.equal(canStartDrag({ item: { kind: 'troop', type: 'dao', level: 1 } }, 0), false, '拖拽未结束时不可覆盖原拖拽物');
  assert.equal(canStartDrag({ item: null }, 2), false, '右键不可开始拖拽');
  assert.equal(canStartDrag({ item: null }, undefined), true, '触控事件没有 button 时仍可起拖');
}

{
  const state = createGame();
  const item = state.bench[0];
  state.bench[0] = null;
  const open = state.grid.flatMap((row, r) => row.map((cell, c) => ({ cell, r, c })))
    .find(({ cell }) => cell.type === 'open' && !cell.unit);
  open.cell.unit = item;
  open.cell.unit = null;
  assert.deepEqual(restoreDrag(state, { item, from: 'board', r: open.r, c: open.c }), {
    ok: true,
    destination: 'board',
    r: open.r,
    c: open.c,
  });
  assert.equal(open.cell.unit, item);
}

console.log('✓ 征兵资源边界与拖拽取消恢复');
