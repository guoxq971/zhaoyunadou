import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ADAPTER_API_VERSION,
  CAPABILITY_STATES,
  REQUIRED_CAPABILITIES,
  assertHostContract,
  createSafeStorage,
  createScopedStorage,
  createWebHost,
} from '../src/platform-services/public.js';
import { createWebSurface } from '../src/platforms/web/web-surface.js';
import { createWebInputSource } from '../src/platforms/web/web-input-source.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';

function eventTarget(seed = {}) {
  const listeners = new Map();
  return Object.assign(seed, {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    emit(type, event = {}) { for (const listener of listeners.get(type) ?? []) listener(event); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  });
}

function fakeCanvas(document) {
  return eventTarget({
    ownerDocument: document,
    width: 0,
    height: 0,
    style: {},
    dataset: {},
    attributes: {},
    getContext() {
      return { setTransform() {} };
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 420, height: 760 }; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() {},
  });
}

function fakeWebScope() {
  const document = eventTarget({ hidden: false, body: {} });
  const canvas = fakeCanvas(document);
  const status = { textContent: '' };
  document.getElementById = (id) => (id === 'game' ? canvas : id === 'game-status' ? status : null);
  document.createElement = (tag) => (tag === 'canvas' ? fakeCanvas(document) : {});

  let timerId = 0;
  const timers = new Set();
  const frames = new Set();
  class FakeImage extends EventTarget {}
  const scope = eventTarget({
    document,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    performance: { now: () => 100 },
    navigator: { language: 'zh-CN', maxTouchPoints: 1, hardwareConcurrency: 8 },
    location: { search: '?e2e=host-contract' },
    URL,
    Image: FakeImage,
    PointerEvent: class {},
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    getComputedStyle() {
      return { paddingTop: '0', paddingRight: '0', paddingBottom: '0', paddingLeft: '0' };
    },
    setInterval() { const id = ++timerId; timers.add(id); return id; },
    clearInterval(id) { timers.delete(id); },
    requestAnimationFrame() { const id = ++timerId; frames.add(id); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    __counts: { timers, frames },
  });
  return scope;
}

assert.match(ADAPTER_API_VERSION, /^\d+\.\d+\.\d+$/);
assert.deepEqual(CAPABILITY_STATES, ['supported', 'degraded', 'unsupported']);
assert.equal(typeof createSafeStorage, 'function', 'Platform public 必须公开安全存储门面');
assert.equal(typeof createScopedStorage, 'function', 'Platform public 必须公开隔离存储门面');
assert.equal(typeof createWebHost, 'function', 'Platform public 必须是 Web Host 的跨系统入口');

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(mainSource, /from ['"]\.\/platform-services\/public\.js['"]/, 'Web 组合根必须仅经 Platform public 装配 Host/服务');
assert.doesNotMatch(mainSource, /platform-services\/local-event-collector|platforms\/web\/web-host/, 'main 不得深导入 Platform 实现');

const scope = fakeWebScope();
const legacySurface = createWebSurface(scope);
assert.deepEqual(legacySurface.getLogicalSize(), { width: 420, height: 760 },
  '旧 createWebSurface(scope) 签名必须继续使用 420×760 兼容尺寸');
legacySurface.destroy();
const host = createWebHost({ scope, gamePack: DEFAULT_GAME_PACK });
assert.equal(assertHostContract(host), host);
assert.equal(host.adapterApiVersion, ADAPTER_API_VERSION);
assert.equal(host.device.getInfo().platform, 'web');
assert.equal(host.surface.getViewport().dpr, 3);
assert.equal(host.storage.scope, 'zyad-e2e-host-contract');

{
  const limitedScope = fakeWebScope();
  delete limitedScope.document.createElement;
  const limitedHost = createWebHost({ scope: limitedScope, gamePack: DEFAULT_GAME_PACK });
  assert.equal(limitedHost.capabilities.offscreenCanvas, 'unsupported');
  assert.equal(limitedHost.surface.createOffscreenCanvas(20, 20), null,
    'Host capability 必须与真实 Adapter 降级结果一致');
  limitedHost.destroy();
}

{
  const fallbackScope = fakeWebScope();
  delete fallbackScope.innerWidth;
  delete fallbackScope.innerHeight;
  const fallbackSurface = createWebSurface(fallbackScope, {
    logicalWidth: 420,
    logicalHeight: 760,
  });
  const fit = fallbackSurface.fit(840, 1520);
  assert.deepEqual(
    { scale: fit.scale, cssWidth: fit.cssWidth, cssHeight: fit.cssHeight },
    { scale: 1, cssWidth: 840, cssHeight: 1520 },
    '缺少浏览器视口全局时，fit 必须使用本次逻辑尺寸作为降级视口',
  );
  fallbackSurface.destroy();
}

for (const state of Object.values(host.capabilities)) {
  assert.ok(CAPABILITY_STATES.includes(state), `unknown capability state ${state}`);
}
for (const capability of REQUIRED_CAPABILITIES) {
  assert.ok(capability in host.capabilities, `missing capability ${capability}`);
}

const unsubscribeInput = host.input.subscribe(() => {});
const lifecycleEvents = [];
const unsubscribeLifecycle = host.lifecycle.subscribe((event) => lifecycleEvents.push(event));
assert.ok(scope.listenerCount() + scope.document.listenerCount() + host.surface.mainCanvas.listenerCount() > 0);
scope.emit('pagehide', { persisted: true });
scope.emit('pageshow', { persisted: true });
assert.deepEqual(lifecycleEvents.map(({ type, reason }) => ({ type, reason })), [
  { type: 'background', reason: 'pagehide-bfcache' },
  { type: 'foreground', reason: 'pageshow-bfcache' },
]);
unsubscribeInput();
unsubscribeLifecycle();
host.destroy();
assert.equal(scope.listenerCount() + scope.document.listenerCount() + host.surface.mainCanvas.listenerCount(), 0);

const touchScope = fakeWebScope();
delete touchScope.PointerEvent;
const touchHost = createWebHost({ scope: touchScope, gamePack: DEFAULT_GAME_PACK });
const standardized = [];
const unsubscribeTouch = touchHost.input.subscribe((event) => { standardized.push(event); return true; });
touchHost.surface.mainCanvas.emit('touchstart', {
  touches: [{ clientX: 42, clientY: 76, identifier: 7 }], preventDefault() {},
});
touchScope.emit('touchend', {
  changedTouches: [{ clientX: 84, clientY: 152, identifier: 7 }], preventDefault() {},
});
assert.deepEqual(standardized.map(({ type, x, y, pointerId, pointerType }) => ({ type, x, y, pointerId, pointerType })), [
  { type: 'pointer-down', x: 42, y: 76, pointerId: 7, pointerType: 'touch' },
  { type: 'pointer-up', x: 84, y: 152, pointerId: 7, pointerType: 'touch' },
]);
unsubscribeTouch();
touchHost.destroy();
assert.equal(touchScope.listenerCount() + touchScope.document.listenerCount() + touchHost.surface.mainCanvas.listenerCount(), 0);

{
  const failingScope = fakeWebScope();
  const originalAdd = failingScope.addEventListener;
  failingScope.addEventListener = function addEventListener(type, listener) {
    if (type === 'keydown') throw new Error('keydown subscription failed');
    return originalAdd.call(this, type, listener);
  };
  const surface = createWebSurface(failingScope);
  const input = createWebInputSource(failingScope, surface);
  const baseline = failingScope.listenerCount()
    + failingScope.document.listenerCount()
    + surface.mainCanvas.listenerCount();
  assert.throws(() => input.subscribe(() => {}), /keydown subscription failed/);
  assert.equal(
    failingScope.listenerCount() + failingScope.document.listenerCount() + surface.mainCanvas.listenerCount(),
    baseline,
    'Web 输入订阅中途失败必须撤销已安装监听器',
  );
  input.destroy();
  surface.destroy();
}

assert.throws(
  () => assertHostContract({ adapterApiVersion: ADAPTER_API_VERSION, capabilities: {} }),
  /Surface|surface/,
);

console.log('✓ Host 版本、能力声明、Web Adapter 契约与取消订阅');
