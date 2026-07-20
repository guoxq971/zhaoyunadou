export const LEGACY_LOGICAL_CANVAS_SIZE = Object.freeze({ width: 420, height: 760 });

export function computeCanvasFit(
  viewportWidth,
  viewportHeight,
  dpr = 1,
  logicalWidth = LEGACY_LOGICAL_CANVAS_SIZE.width,
  logicalHeight = LEGACY_LOGICAL_CANVAS_SIZE.height,
) {
  const normalizedLogicalWidth = Number(logicalWidth);
  const normalizedLogicalHeight = Number(logicalHeight);
  if (!Number.isFinite(normalizedLogicalWidth) || normalizedLogicalWidth <= 0
    || !Number.isFinite(normalizedLogicalHeight) || normalizedLogicalHeight <= 0) {
    throw new TypeError('[canvas-fit] logicalWidth and logicalHeight must be positive numbers');
  }
  const safeWidth = Math.max(1, Number(viewportWidth) || normalizedLogicalWidth);
  const safeHeight = Math.max(1, Number(viewportHeight) || normalizedLogicalHeight);
  const safeDpr = Math.max(1, Number(dpr) || 1);
  // 桌面保持参考图的原生游戏宽度；窄屏只做等比缩小，避免笔触被放大变糊。
  const scale = Math.min(
    1,
    safeWidth / normalizedLogicalWidth,
    safeHeight / normalizedLogicalHeight,
  );
  const cssWidth = Math.round(normalizedLogicalWidth * scale);
  const cssHeight = Math.round(normalizedLogicalHeight * scale);
  const pixelWidth = Math.max(1, Math.round(cssWidth * safeDpr));
  const pixelHeight = Math.max(1, Math.round(cssHeight * safeDpr));
  return {
    scale,
    cssWidth,
    cssHeight,
    pixelWidth,
    pixelHeight,
    transformScale: pixelWidth / normalizedLogicalWidth,
  };
}
