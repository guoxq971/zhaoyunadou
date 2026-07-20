import { computeCanvasFit } from '../../canvas-fit.js';

const number = (value) => (Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : 0);

export function createWebSurface(scope, {
  canvasId = 'game',
  statusOutputId = 'game-status',
  logicalWidth = 420,
  logicalHeight = 760,
} = {}) {
  const documentRef = scope?.document;
  const mainCanvas = documentRef?.getElementById?.(canvasId);
  if (!mainCanvas) throw new Error(`[web-surface] canvas #${canvasId} was not found`);
  const context = mainCanvas.getContext?.('2d');
  if (!context) throw new Error('[web-surface] Canvas2D context is unavailable');
  const statusOutput = documentRef.getElementById?.(statusOutputId) ?? null;
  const viewportSubscriptions = new Set();
  let logical = { width: logicalWidth, height: logicalHeight };

  function safeArea() {
    const style = typeof scope.getComputedStyle === 'function'
      ? scope.getComputedStyle(documentRef.body)
      : null;
    return Object.freeze({
      top: number(style?.paddingTop),
      right: number(style?.paddingRight),
      bottom: number(style?.paddingBottom),
      left: number(style?.paddingLeft),
    });
  }

  function getViewport() {
    return Object.freeze({
      width: Math.max(1, Number(scope.innerWidth) || logical.width),
      height: Math.max(1, Number(scope.innerHeight) || logical.height),
      dpr: Math.max(1, Number(scope.devicePixelRatio) || 1),
      safeArea: safeArea(),
    });
  }

  function fit(width = logical.width, height = logical.height) {
    logical = { width, height };
    const viewport = getViewport();
    const box = computeCanvasFit(viewport.width, viewport.height, viewport.dpr, width, height);
    mainCanvas.width = box.pixelWidth;
    mainCanvas.height = box.pixelHeight;
    mainCanvas.style.width = `${box.cssWidth}px`;
    mainCanvas.style.height = `${box.cssHeight}px`;
    context.setTransform(box.transformScale, 0, 0, box.transformScale, 0, 0);
    return box;
  }

  function createOffscreenCanvas(width, height) {
    const canvas = documentRef.createElement?.('canvas');
    if (!canvas) return null;
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function createImage() {
    try { return typeof scope.Image === 'function' ? new scope.Image() : null; }
    catch { return null; }
  }

  function setStateDataset(dataset) {
    if (mainCanvas.dataset) Object.assign(mainCanvas.dataset, dataset);
  }

  function setAccessibleStatus(label) {
    mainCanvas.setAttribute?.('aria-label', label);
    if (statusOutput) statusOutput.textContent = label;
  }

  function subscribeViewport(listener) {
    if (typeof listener !== 'function') throw new TypeError('[web-surface] viewport listener is required');
    const handler = () => listener(getViewport());
    scope.addEventListener?.('resize', handler);
    const unsubscribe = () => scope.removeEventListener?.('resize', handler);
    viewportSubscriptions.add(unsubscribe);
    return () => {
      if (!viewportSubscriptions.delete(unsubscribe)) return;
      unsubscribe();
    };
  }

  function destroy() {
    for (const unsubscribe of [...viewportSubscriptions]) unsubscribe();
    viewportSubscriptions.clear();
  }

  return Object.freeze({
    mainCanvas,
    getMainCanvas: () => mainCanvas,
    getContext: () => context,
    getViewport,
    getLogicalSize: () => Object.freeze({ ...logical }),
    fit,
    focus: () => mainCanvas.focus?.({ preventScroll: true }),
    createOffscreenCanvas,
    createImage,
    setStateDataset,
    setAccessibleStatus,
    subscribeViewport,
    destroy,
  });
}
