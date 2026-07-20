import { ADAPTER_API_VERSION, assertHostContract } from '../../platform-contracts/host.js';
import { createWebAssetAdapter } from './web-assets.js';
import { createWebAudioAdapter } from './web-audio.js';
import { createWebInputSource } from './web-input-source.js';
import { createWebLifecycle } from './web-lifecycle.js';
import { createWebScheduler } from './web-scheduler.js';
import { createWebStorage } from './web-storage.js';
import { createWebSurface } from './web-surface.js';

export function createWebHost({ scope = globalThis, gamePack, audioCueSource } = {}) {
  if (!gamePack?.config || !gamePack?.manifests) {
    throw new TypeError('[web-host] gamePack is required');
  }
  const config = gamePack.config;
  const surface = createWebSurface(scope, {
    logicalWidth: config.canvas.w,
    logicalHeight: config.canvas.h,
  });
  const scheduler = createWebScheduler(scope);
  const lifecycle = createWebLifecycle(scope);
  const input = createWebInputSource(scope, surface);
  const storage = createWebStorage(scope);
  const assets = createWebAssetAdapter(scope, surface);
  const audio = createWebAudioAdapter(scope, audioCueSource ?? gamePack.manifests.audio);
  const hasScopeEvents = typeof scope.addEventListener === 'function'
    && typeof scope.removeEventListener === 'function';
  const hasDocumentEvents = typeof scope.document?.addEventListener === 'function'
    && typeof scope.document?.removeEventListener === 'function';
  const hasCanvasEvents = typeof surface.getMainCanvas()?.addEventListener === 'function'
    && typeof surface.getMainCanvas()?.removeEventListener === 'function';
  const hasScheduler = typeof scope.setInterval === 'function'
    && typeof scope.clearInterval === 'function'
    && typeof scope.requestAnimationFrame === 'function'
    && typeof scope.cancelAnimationFrame === 'function';
  const debugKeys = new Set();
  const debug = Object.freeze({
    expose(handles) {
      for (const [key, value] of Object.entries(handles)) {
        scope[key] = value;
        debugKeys.add(key);
      }
    },
    clear() {
      for (const key of debugKeys) {
        try { delete scope[key]; } catch { scope[key] = undefined; }
      }
      debugKeys.clear();
    },
  });
  const device = Object.freeze({
    getInfo() {
      const viewport = surface.getViewport();
      return Object.freeze({
        platform: 'web',
        language: scope.navigator?.language ?? gamePack.manifests.game.locale,
        viewport: Object.freeze({ width: viewport.width, height: viewport.height, dpr: viewport.dpr }),
        safeArea: viewport.safeArea,
        performanceTier: 'unknown',
        hardwareConcurrency: Number(scope.navigator?.hardwareConcurrency) || null,
      });
    },
  });
  let destroyed = false;
  const host = {
    adapterApiVersion: ADAPTER_API_VERSION,
    capabilities: Object.freeze({
      surface: 'supported',
      offscreenCanvas: typeof scope.document?.createElement === 'function' ? 'supported' : 'unsupported',
      image: typeof scope.Image === 'function' ? 'supported' : 'unsupported',
      pointer: typeof scope.PointerEvent === 'function' ? 'supported' : 'degraded',
      touch: Number(scope.navigator?.maxTouchPoints) > 0 ? 'supported' : 'degraded',
      keyboard: hasScopeEvents ? 'supported' : 'unsupported',
      storage: storage.persistent ? 'supported' : 'degraded',
      assets: typeof scope.Image === 'function' ? 'supported' : 'degraded',
      audio: (scope.AudioContext || scope.webkitAudioContext) ? 'supported' : 'unsupported',
      lifecycle: hasScopeEvents && hasDocumentEvents
        ? 'supported'
        : hasScopeEvents || hasDocumentEvents ? 'degraded' : 'unsupported',
      scheduler: hasScheduler ? 'supported' : 'unsupported',
      safeArea: typeof scope.getComputedStyle === 'function' ? 'supported' : 'degraded',
      input: hasScopeEvents && hasCanvasEvents ? 'supported' : 'unsupported',
      deviceInfo: 'supported',
    }),
    surface,
    scheduler,
    lifecycle,
    input,
    storage,
    assets,
    audio,
    device,
    debug,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      input.destroy();
      lifecycle.destroy();
      surface.destroy();
      scheduler.cancelAll();
      assets.destroy();
      debug.clear();
      return true;
    },
  };
  return assertHostContract(Object.freeze(host));
}
