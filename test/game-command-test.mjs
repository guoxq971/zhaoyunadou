import assert from 'node:assert/strict';
import {
  gameCommandFromInput,
  subscribeGameCommands,
} from '../src/engine-core/game-command-source.js';
import {
  GAME_COMMAND_API_VERSION,
  createCommandDispatcher,
  createCommandFactory,
  createCommandLog,
  hashCommandState,
} from '../src/engine-core/game-command.js';

assert.deepEqual(gameCommandFromInput({
  type: 'pointer-down', x: 12, y: 34, button: 0,
  pointerId: 7, pointerType: 'touch', primary: true,
}), {
  type: 'pointer.begin', x: 12, y: 34, button: 0,
  pointerId: 7, pointerType: 'touch', primary: true,
});
assert.deepEqual(gameCommandFromInput({ type: 'key-down', code: 'KeyR' }), {
  type: 'key.press', code: 'KeyR', repeat: false,
  metaKey: false, ctrlKey: false, altKey: false,
});
assert.deepEqual(gameCommandFromInput({
  type: 'cancel', reason: 'pointer-cancel', pointerId: 7,
}), {
  type: 'pointer.cancel', reason: 'pointer-cancel', pointerId: 7,
});
assert.deepEqual(gameCommandFromInput({ type: 'cancel', reason: 'blur' }), {
  type: 'pointer.cancel', reason: 'blur', pointerId: null,
});
assert.equal(gameCommandFromInput({ type: 'unknown' }), null);

let inputListener = null;
let unsubscribed = false;
const commands = [];
const unsubscribe = subscribeGameCommands({
  subscribe(listener) {
    inputListener = listener;
    return () => { unsubscribed = true; inputListener = null; };
  },
}, (command) => { commands.push(command); return true; });
assert.equal(inputListener({ type: 'pointer-up', x: 8, y: 9, pointerId: 3 }), true);
assert.equal(inputListener({ type: 'ignored' }), false);
assert.equal(commands[0].type, 'pointer.end');
unsubscribe();
assert.equal(unsubscribed, true);

assert.match(GAME_COMMAND_API_VERSION, /^\d+\.\d+\.\d+$/);
let tick = 3;
let time = 1.25;
const factory = createCommandFactory({
  actorId: 'local-player',
  side: 'player',
  getTick: () => tick,
  getTime: () => time,
});
const first = factory.create('battle.batch_recruit', { requestedSlots: 5 });
assert.deepEqual(first, {
  apiVersion: GAME_COMMAND_API_VERSION,
  type: 'battle.batch_recruit',
  actorId: 'local-player',
  side: 'player',
  sequence: 1,
  tick: 3,
  time: 1.25,
  payload: { requestedSlots: 5 },
});
assert.doesNotThrow(() => JSON.stringify(first));
const callerPayload = { source: { zone: 'bench', index: 0 }, unit: { kind: 'troop', level: 1 } };
const isolated = factory.create('unit.drop', callerPayload);
assert.notEqual(isolated.payload, callerPayload, '命令必须隔离调用方 payload 引用');
assert.notEqual(isolated.payload.unit, callerPayload.unit);
assert.equal(Object.isFrozen(callerPayload.unit), false, '创建命令不得冻结玩法对象');
callerPayload.unit.level = 2;
assert.equal(isolated.payload.unit.level, 1, '调用方后续修改不得篡改已记录命令');
assert.throws(() => factory.create('bad command', {}), /type/);
assert.throws(() => factory.create('battle.pause.toggle', { node: () => {} }), /serializable/);

const gameplayState = { value: 0 };
const callerHeader = { seed: 'replay-seed', cursor: { gameplay: 2 } };
const isolatedHeaderLog = createCommandLog({ header: callerHeader });
callerHeader.cursor.gameplay = 99;
assert.deepEqual(isolatedHeaderLog.header, { seed: 'replay-seed', cursor: { gameplay: 2 } },
  'CommandLog 必须在构造时隔离并冻结回放头，不能跟随调用方引用变化');
const log = createCommandLog({ limit: 2 });
const dispatcher = createCommandDispatcher({
  handlers: {
    'counter.add'(command) {
      gameplayState.value += command.payload.amount;
      return { ok: true, reason: 'none', value: gameplayState.value };
    },
  },
  getStateSummary: () => gameplayState,
  commandLog: log,
});
const polluted = {
  ...factory.create('counter.add', { amount: 100 }),
  hostObject: new Date(),
};
assert.throws(() => dispatcher.dispatch(polluted), /unexpected field|plain data|serializable/,
  'Command envelope 必须在 handler 之前拒绝 DOM/Canvas/SDK 等额外平台对象');
assert.equal(gameplayState.value, 0, '非法 Command 不得先改状态、后在日志阶段失败');

const hiddenPolluted = { ...factory.create('counter.add', { amount: 100 }) };
Object.defineProperty(hiddenPolluted, 'hostObject', {
  value: new Date(),
  enumerable: false,
});
assert.throws(() => dispatcher.dispatch(hiddenPolluted), /unexpected field|plain data|serializable/,
  '不可枚举平台对象不能绕过 Command envelope 校验');
assert.equal(gameplayState.value, 0, '隐藏字段非法 Command 不得调用 handler');

const symbolPolluted = { ...factory.create('counter.add', { amount: 100 }) };
symbolPolluted[Symbol('host-object')] = new Date();
assert.throws(() => dispatcher.dispatch(symbolPolluted), /unexpected field|plain data|serializable/,
  'Symbol 字段不能绕过 Command envelope 校验');
assert.equal(gameplayState.value, 0, 'Symbol 字段非法 Command 不得调用 handler');

let getterReads = 0;
const accessorPayload = {};
Object.defineProperty(accessorPayload, 'amount', {
  enumerable: true,
  get() { getterReads++; return 100; },
});
assert.throws(() => factory.create('counter.add', accessorPayload), /plain data|serializable|accessor/,
  'payload accessor 必须在 clone/handler 前拒绝');
assert.equal(getterReads, 0, '校验非法 accessor 时不得执行调用方 getter');

const sparsePayload = [];
sparsePayload.length = 2;
sparsePayload[1] = 'unit';
assert.throws(() => factory.create('unit.drop', { path: sparsePayload }), /serializable|sparse/,
  '稀疏数组不能在 JSON clone 时静默变成 null');
const prototypeKeys = JSON.parse('{"__proto__":{"platform":"wx"},"constructor":"data","prototype":"value"}');
const prototypeSafe = factory.create('counter.add', prototypeKeys);
assert.equal(Object.getPrototypeOf(prototypeSafe.payload), Object.prototype);
assert.equal(Object.hasOwn(prototypeSafe.payload, '__proto__'), true,
  '合法 JSON 键 __proto__ 必须保持为 own data property，不能污染克隆原型');
assert.deepEqual(prototypeSafe.payload.__proto__, { platform: 'wx' });
assert.equal(prototypeSafe.payload.constructor, 'data');
assert.equal(prototypeSafe.payload.prototype, 'value');
tick++;
time += 0.5;
assert.equal(dispatcher.dispatch(factory.create('counter.add', { amount: 2 })).value, 2);
assert.equal(dispatcher.dispatch(factory.create('counter.add', { amount: 3 })).value, 5);
assert.equal(dispatcher.dispatch(factory.create('counter.add', { amount: 4 })).value, 9);
assert.equal(log.size, 2);
assert.equal(log.dropped, 1);
assert.deepEqual(log.getEntries().map(({ result }) => result.value), [5, 9]);
assert.equal(log.getEntries().at(-1).stateHash, hashCommandState(gameplayState));
assert.throws(() => { log.getEntries().push({}); }, TypeError);
const stale = dispatcher.dispatch({ ...factory.create('counter.add', { amount: 1 }), sequence: 2 });
assert.deepEqual(stale, { ok: false, reason: 'stale-sequence' });
assert.equal(gameplayState.value, 9);

console.log('✓ 标准输入映射、可序列化 GameCommand、有限日志与状态哈希');
