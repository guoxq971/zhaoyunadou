import { LEGACY_LOGICAL_CANVAS_SIZE, computeCanvasFit } from '../../canvas-fit.js';

const number = (value) => (Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : 0);

export function createWebSurface(scope, {
  canvasId = 'game',
  statusOutputId = 'game-status',
  logicalWidth = LEGACY_LOGICAL_CANVAS_SIZE.width,
  logicalHeight = LEGACY_LOGICAL_CANVAS_SIZE.height,
} = {}) {
  const initialWidth = Number(logicalWidth);
  const initialHeight = Number(logicalHeight);
  if (!Number.isFinite(initialWidth) || initialWidth <= 0
    || !Number.isFinite(initialHeight) || initialHeight <= 0) {
    throw new TypeError('[web-surface] logicalWidth and logicalHeight must be positive numbers');
  }
  const documentRef = scope?.document;
  const mainCanvas = documentRef?.getElementById?.(canvasId);
  if (!mainCanvas) throw new Error(`[web-surface] canvas #${canvasId} was not found`);
  const context = mainCanvas.getContext?.('2d');
  if (!context) throw new Error('[web-surface] Canvas2D context is unavailable');
  const statusOutput = documentRef.getElementById?.(statusOutputId) ?? null;
  const viewportSubscriptions = new Set();
  let logical = { width: initialWidth, height: initialHeight };

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

  function getViewport(fallbackLogical = logical) {
    return Object.freeze({
      width: Math.max(1, Number(scope.innerWidth) || fallbackLogical.width),
      height: Math.max(1, Number(scope.innerHeight) || fallbackLogical.height),
      dpr: Math.max(1, Number(scope.devicePixelRatio) || 1),
      safeArea: safeArea(),
    });
  }

  function fit(width = logical.width, height = logical.height) {
    const next = { width: Number(width), height: Number(height) };
    const viewport = getViewport(next);
    const box = computeCanvasFit(
      viewport.width,
      viewport.height,
      viewport.dpr,
      next.width,
      next.height,
    );
    logical = next;
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
