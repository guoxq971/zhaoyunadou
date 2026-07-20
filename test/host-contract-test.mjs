import assert from 'node:assert/strict';
import {
  ADAPTER_API_VERSION,
  CAPABILITY_STATES,
  REQUIRED_CAPABILITIES,
  assertHostContract,
} from '../src/platform-contracts/host.js';
import { createWebHost } from '../src/platforms/web/web-host.js';
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

const scope = fakeWebScope();
const host = createWebHost({ scope, gamePack: DEFAULT_GAME_PACK });
assert.equal(assertHostContract(host), host);
assert.equal(host.adapterApiVersion, ADAPTER_API_VERSION);
assert.equal(host.device.getInfo().platform, 'web');
assert.equal(host.surface.getViewport().dpr, 3);
assert.equal(host.storage.scope, 'zyad-e2e-host-contract');

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

assert.throws(
  () => assertHostContract({ adapterApiVersion: ADAPTER_API_VERSION, capabilities: {} }),
  /Surface|surface/,
);

console.log('✓ Host 版本、能力声明、Web Adapter 契约与取消订阅');
