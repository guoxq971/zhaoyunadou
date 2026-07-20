import { CONFIG } from './config.js';

export function computeCanvasFit(
  viewportWidth,
  viewportHeight,
  dpr = 1,
  logicalWidth = CONFIG.canvas.w,
  logicalHeight = CONFIG.canvas.h,
) {
  const safeWidth = Math.max(1, Number(viewportWidth) || logicalWidth);
  const safeHeight = Math.max(1, Number(viewportHeight) || logicalHeight);
  const safeDpr = Math.max(1, Number(dpr) || 1);
  // 桌面保持参考图的原生游戏宽度；窄屏只做等比缩小，避免笔触被放大变糊。
  const scale = Math.min(1, safeWidth / logicalWidth, safeHeight / logicalHeight);
  const cssWidth = Math.round(logicalWidth * scale);
  const cssHeight = Math.round(logicalHeight * scale);
  const pixelWidth = Math.max(1, Math.round(cssWidth * safeDpr));
  const pixelHeight = Math.max(1, Math.round(cssHeight * safeDpr));
  return {
    scale,
    cssWidth,
    cssHeight,
    pixelWidth,
    pixelHeight,
    transformScale: pixelWidth / logicalWidth,
  };
}
