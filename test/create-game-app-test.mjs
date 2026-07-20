import assert from 'node:assert/strict';
import { createGameApp } from '../src/app-shell/create-game-app.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { getStateSlice } from '../src/engine-core/public.js';
import { ADAPTER_API_VERSION } from '../src/platform-contracts/host.js';
import { UI } from '../src/ui-layout.js';

function fakeHost({ throwingAdapters = false, audioState = 'supported', faultAt = '' } = {}) {
  const counters = {
    input: 0,
    lifecycle: 0,
    logic: 0,
    render: 0,
    audioDestroy: 0,
    debugHandles: 0,
    viewport: 0,
  };
  let inputListener = null;
  let lifecycleListener = null;
  let debugHandles = null;
  const values = new Map([['zyad_cleared_stars', '3']]);
  const canvas = { dataset: {} };
  const host = {
    adapterApiVersion: ADAPTER_API_VERSION,
    capabilities: {
      surface: 'supported', offscreenCanvas: 'unsupported', image: 'unsupported',
      pointer: 'supported', touch: 'degraded', keyboard: 'supported',
      input: 'supported', storage: 'supported', assets: 'degraded', audio: audioState,
      lifecycle: 'supported', scheduler: 'supported', deviceInfo: 'supported',
      safeArea: 'degraded',
    },
    surface: {
      mainCanvas: canvas,
      getMainCanvas: () => canvas,
      getContext: () => ({}),
      getViewport: () => ({ width: 420, height: 760, dpr: 1, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } }),
      fit() {},
      focus() {},
      createOffscreenCanvas: () => null,
      createImage: () => null,
      setStateDataset(dataset) { Object.assign(canvas.dataset, dataset); },
      setAccessibleStatus() {},
      subscribeViewport() {
        counters.viewport++;
        return () => { counters.viewport--; };
      },
    },
    scheduler: {
      now: () => 100,
      startLogicLoop() { counters.logic++; return () => { counters.logic--; }; },
      startRenderLoop() { counters.render++; return () => { counters.render--; }; },
      cancelAll() { counters.logic = 0; counters.render = 0; },
    },
    lifecycle: {
      getState: () => 'foreground',
      subscribe(listener) {
        if (faultAt === 'lifecycle') throw new Error('lifecycle boom');
        counters.lifecycle++;
        lifecycleListener = listener;
        return () => { counters.lifecycle--; lifecycleListener = null; };
      },
    },
    input: {
      subscribe(listener) {
        if (faultAt === 'input') throw new Error('input boom');
        counters.input++;
        inputListener = listener;
        return () => { counters.input--; inputListener = null; };
      },
    },
    storage: {
      persistent: true,
      scope: '',
      getItem(key) { if (throwingAdapters) throw new Error('read failed'); return values.get(key) ?? null; },
      setItem(key, value) { if (throwingAdapters) throw new Error('write failed'); values.set(key, String(value)); return true; },
      removeItem(key) { if (throwingAdapters) throw new Error('remove failed'); values.delete(key); return true; },
    },
    assets: {
      resolvePath(path) { return path; },
      loadImage(definition, path) { return { image: null, status: 'unavailable', path, definition }; },
      status() { if (throwingAdapters) throw new Error('asset status failed'); return { ready: true, failed: 0 }; },
      destroy() {},
    },
    audio: {
      async init() { if (throwingAdapters) throw new Error('audio init failed'); return audioState === 'supported'; },
      play() { if (throwingAdapters) throw new Error('audio play failed'); return false; },
      async pause() {},
      async resume() {},
      setVolume() {},
      async destroy() { counters.audioDestroy++; },
    },
    device: {
      getInfo: () => ({
        platform: 'test', language: 'zh-CN', viewport: { width: 420, height: 760 },
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 }, performanceTier: 'test',
      }),
    },
    debug: {
      expose(handles) {
        if (faultAt === 'debug') throw new Error('debug boom');
        debugHandles = handles;
        counters.debugHandles = Object.keys(handles).length;
      },
      clear() { debugHandles = null; counters.debugHandles = 0; },
    },
    destroy() {},
    __test: {
      counters,
      emitInput(event) { inputListener?.(event); },
      emitLifecycle(event) { lifecycleListener?.(event); },
      get handles() { return debugHandles; },
    },
  };
  return host;
}

for (let cycle = 0; cycle < 3; cycle++) {
  const host = fakeHost();
  const app = createGameApp({ gamePack: DEFAULT_GAME_PACK, host, services: { randomSeed: 100 + cycle } });
  assert.equal(app.start(), true);
  assert.equal(app.start(), false, '同一应用不得重复启动循环或输入');
    assert.equal(host.__test.handles.__commands.header.random.seed, String(100 + cycle),
      '命令日志头必须记录可恢复的随机 seed/游标快照');
    assert.equal(app.getStateSnapshot().clearedStars, 3, '旧存档键必须继续读取');
    assert.equal('commandLog' in app.getStateSnapshot(), false, '命令日志不得进入玩法状态或旧存档');
  if (cycle === 0) {
    const liveState = host.__test.handles.__game.state;
    const pieceId = liveState.bench[0].pieceId;
    getStateSlice(liveState, 'combat').attackCooldowns[pieceId] = 1.25;
    getStateSlice(liveState, 'skillStatus').nextEntitySequence = 4;
    getStateSlice(liveState, 'encounter').nextEnemySequence = 3;
    const legacyExpected = JSON.parse(JSON.stringify(liveState, (_key, value) => (
      value instanceof Set ? [...value] : value
    )));
    const snapshot = app.getStateSnapshot();
    const { runtimeSlices, ...legacyActual } = snapshot;
    assert.deepEqual(legacyActual, legacyExpected,
      'getStateSnapshot 必须与当前 flat V2 live facade 的可枚举字段一致');
    assert.equal(snapshot.stage.id, liveState.stage.id);
    assert.deepEqual(snapshot.path, liveState.path);
    assert.deepEqual(snapshot.paths, liveState.paths);
    assert.equal(runtimeSlices.commandState.bench[0].pieceId, pieceId,
      'App MatchSnapshot 不得丢失 non-enumerable Piece 稳定身份');
    assert.equal(runtimeSlices.commandState.combatRuntime.attackCooldowns[pieceId], 1.25,
      'App MatchSnapshot 必须包含 WeakMap Combat 私有切片');
    assert.equal(runtimeSlices.commandState.nextSkillEntitySequence, 4);
    assert.equal(runtimeSlices.commandState.encounterRuntime.nextEnemySequence, 3);
    assert.equal(Object.isFrozen(snapshot.bench[0]), true, '受控快照必须与在线状态隔离');
  }
  assert.deepEqual(
    { input: host.__test.counters.input, lifecycle: host.__test.counters.lifecycle, logic: host.__test.counters.logic, render: host.__test.counters.render },
    { input: 1, lifecycle: 1, logic: 1, render: 1 },
  );
  if (cycle === 0) {
    const point = { x: UI.start.x + UI.start.w / 2, y: UI.start.y + UI.start.h / 2, button: 0 };
    host.__test.emitInput({ type: 'pointer-down', ...point, pointerId: 2, primary: false });
    host.__test.emitInput({ type: 'pointer-up', ...point, pointerId: 2, primary: false });
    assert.equal(app.getStateSnapshot().title, true, '非主触点不可触发标题页命令');
    host.__test.emitInput({ type: 'pointer-down', ...point, pointerId: 1, primary: true });
    host.__test.emitInput({ type: 'pointer-up', ...point, pointerId: 1, primary: true });
    assert.equal(app.getStateSnapshot().title, false, '主触点仍使用共享标题页玩法');
    assert.equal(app.getCommandLogSnapshot().at(-1).command.type, 'campaign.start_stage');
  }
  app.pause();
  app.resume();
  assert.equal(app.destroy(), true);
  assert.equal(app.destroy(), false, '销毁必须幂等');
  assert.deepEqual(
    { input: host.__test.counters.input, lifecycle: host.__test.counters.lifecycle, logic: host.__test.counters.logic, render: host.__test.counters.render, debug: host.__test.counters.debugHandles },
    { input: 0, lifecycle: 0, logic: 0, render: 0, debug: 0 },
  );
  assert.equal(host.__test.counters.audioDestroy, 1);
}

for (const faultAt of ['input', 'lifecycle', 'debug']) {
  const host = fakeHost({ faultAt });
  const errors = [];
  const app = createGameApp({
    gamePack: DEFAULT_GAME_PACK,
    host,
    services: { randomSeed: 8, onAdapterError: (error, source) => errors.push({ error, source }) },
  });
  assert.equal(app.start(), false, `${faultAt} 装配失败必须明确返回 false`);
  assert.equal(app.start(), false, `${faultAt} 重试失败也不得叠加资源`);
  assert.deepEqual(
    { viewport: host.__test.counters.viewport, input: host.__test.counters.input, lifecycle: host.__test.counters.lifecycle,
      logic: host.__test.counters.logic, render: host.__test.counters.render, debug: host.__test.counters.debugHandles },
    { viewport: 0, input: 0, lifecycle: 0, logic: 0, render: 0, debug: 0 },
  );
  assert.ok(errors.some((entry) => entry.source === 'app.start'));
  assert.doesNotThrow(() => app.destroy());
}

{
  const host = fakeHost({ throwingAdapters: true, audioState: 'degraded' });
  const app = createGameApp({ gamePack: DEFAULT_GAME_PACK, host, services: { randomSeed: 7 } });
  assert.doesNotThrow(() => app.start(), 'Adapter 异常不得中断核心启动');
  assert.doesNotThrow(() => host.__test.emitInput({ type: 'key-down', code: 'Enter' }));
  assert.doesNotThrow(() => host.__test.emitLifecycle({ type: 'background', reason: 'test' }));
  assert.doesNotThrow(() => host.__test.emitLifecycle({ type: 'foreground', reason: 'test' }));
  assert.doesNotThrow(() => app.destroy());
}

{
  const host = fakeHost();
  const errors = [];
  const app = createGameApp({
    gamePack: DEFAULT_GAME_PACK,
    host,
    services: {
      randomSeed: 9,
      events: { emit() { throw new Error('telemetry reporter down'); } },
      onAdapterError: (error, source) => errors.push({ error, source }),
    },
  });
  assert.equal(app.start(), true, 'Telemetry reporter 失败不得中断应用启动');
  assert.doesNotThrow(() => app.destroy(), 'Telemetry reporter 失败不得中断会话收尾');
  assert.ok(errors.some(({ source }) => source?.eventId === 'session_start'));
  assert.ok(errors.some(({ source }) => source?.eventId === 'session_end'));
}

{
  const host = fakeHost();
  let completeAudioDestroy;
  let audioReleased = false;
  host.audio.destroy = () => new Promise((resolve) => {
    completeAudioDestroy = () => {
      audioReleased = true;
      resolve();
    };
  });
  const app = createGameApp({ gamePack: DEFAULT_GAME_PACK, host, services: { randomSeed: 10 } });
  assert.equal(app.start(), true);
  assert.equal(app.destroy(), true, '同步 destroy 布尔签名继续兼容');
  assert.equal(audioReleased, false, '自定义 Host 可以异步释放原生音频');
  const completion = app.whenDestroyed();
  completeAudioDestroy();
  assert.equal(await completion, true);
  assert.equal(audioReleased, true, 'whenDestroyed 必须等到音频实例真正释放');
}

console.log('✓ createGameApp 启停、异常降级、旧存档与三次无泄漏销毁');
