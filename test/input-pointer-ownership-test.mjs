import assert from 'node:assert/strict';
import { attachInput } from '../src/input.js';
import { createGame } from '../src/state.js';
import { benchRect } from '../src/ui-layout.js';

let listener = null;
const inputSource = {
  subscribe(next) {
    listener = next;
    return () => { listener = null; };
  },
};
const state = createGame();
state.title = false;
const original = state.bench[0];
const drag = { item: null, x: 0, y: 0, mode: null, from: null, index: null, r: null, c: null };
const game = { state };
const surface = { focus() {} };
const stop = attachInput(inputSource, surface, game, drag);
const slot = benchRect(0);

assert.equal(listener({
  type: 'pointer-down', pointerId: 1, primary: true, button: 0,
  x: slot.x + slot.w / 2, y: slot.y + slot.h / 2,
}), true);
assert.notEqual(drag.item, original, '交互态只能拿到弈子快照，不能持有玩法实体引用');
assert.deepEqual(drag.item, original, '拖拽快照必须保留绘制和落点所需字段');
assert.ok(Object.isFrozen(drag.item), '拖拽快照必须只读');
assert.throws(() => { drag.item.level = 99; }, TypeError);
assert.equal(original.level, 1, '修改交互快照不得绕过 GameCommand 改变弈子');
assert.equal(state.bench[0], original, '起拖只保留源位置，不得让玩法状态暂时丢失单位');

assert.equal(listener({ type: 'cancel', reason: 'pointer-cancel', pointerId: 2 }), false);
assert.deepEqual(drag.item, original, '次触点取消不得打断主触点拖拽');
assert.equal(state.bench[0], original);

assert.equal(listener({ type: 'cancel', reason: 'pointer-cancel', pointerId: 1 }), true);
assert.equal(drag.item, null, '主触点取消后应结束拖拽');
assert.equal(state.bench[0], original, '主触点取消前后玩法状态必须保持不变');

stop();
assert.equal(listener, null);

console.log('✓ 多触点取消只作用于当前主拖拽');
