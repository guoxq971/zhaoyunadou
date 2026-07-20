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
