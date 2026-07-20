// 水墨视觉令牌与素材回退。素材只负责氛围，交互状态仍由 Canvas 绘制。
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { createAssetLoader } from './engine-core/assets.js';

const THEME = DEFAULT_GAME_PACK.manifests.theme;
export const KAI = THEME.fontFamily;
export const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px ${KAI}`;

const PRESENTATION_FALLBACK = Object.freeze({
  backdrop: Object.freeze({
    artAlpha: 0.3,
    veilTop: 'rgba(238,226,201,0.42)',
    veilMid: 'rgba(232,218,193,0.22)',
    veilBottom: 'rgba(225,208,180,0.36)',
  }),
  strokes: Object.freeze({ hairline: 0.8, default: 1.5, strong: 2.5, focus: 3 }),
  shadows: Object.freeze({ cardBlur: 4, cardOffsetY: 2, boardBlur: 8, buttonBlur: 5 }),
  motion: Object.freeze({
    titleRevealSeconds: 0.5,
    feedbackSeconds: 0.62,
    batchStepSeconds: 0.08,
    invalidReboundSeconds: 0.22,
    targetPulseHz: 1.2,
  }),
  route: Object.freeze({
    lineWidth: 2.5,
    underlayWidth: 4.5,
    dash: Object.freeze([7, 5]),
    primaryAlpha: 0.82,
    secondaryAlpha: 0.68,
    markerRadius: 10,
    arrowSize: 7,
    arrowAlpha: 0.95,
  }),
  title: Object.freeze({
    mascotWidth: 128,
    mascotMaxWidth: 144,
    revealOffsetY: 8,
    revealAlphaStart: 0.78,
    peripheralAlpha: 0.65,
  }),
});

const presentationTokenCache = new WeakMap();

export function themeColors(gamePack = DEFAULT_GAME_PACK) {
  return gamePack.manifests.theme.colors;
}

// 令牌可选是为了兼容尚未升级的内容包；默认包由 Schema 强制提供完整值。
export function presentationTokens(gamePack = DEFAULT_GAME_PACK) {
  if (presentationTokenCache.has(gamePack)) return presentationTokenCache.get(gamePack);
  const tokens = gamePack.manifests.theme.presentation ?? {};
  const resolved = Object.freeze({
    backdrop: Object.freeze({ ...PRESENTATION_FALLBACK.backdrop, ...tokens.backdrop }),
    strokes: Object.freeze({ ...PRESENTATION_FALLBACK.strokes, ...tokens.strokes }),
    shadows: Object.freeze({ ...PRESENTATION_FALLBACK.shadows, ...tokens.shadows }),
    motion: Object.freeze({ ...PRESENTATION_FALLBACK.motion, ...tokens.motion }),
    route: Object.freeze({
      ...PRESENTATION_FALLBACK.route,
      ...tokens.route,
      dash: Object.freeze([...(tokens.route?.dash ?? PRESENTATION_FALLBACK.route.dash)]),
    }),
    title: Object.freeze({ ...PRESENTATION_FALLBACK.title, ...tokens.title }),
  });
  presentationTokenCache.set(gamePack, resolved);
  return resolved;
}

const fallbackPresentationAssets = new WeakMap();
const hostPresentationAssets = new WeakMap();

function assetCache(host) {
  if (!host) return fallbackPresentationAssets;
  if (!hostPresentationAssets.has(host)) hostPresentationAssets.set(host, new WeakMap());
  return hostPresentationAssets.get(host);
}

// 每个 Game Pack 独立持有素材加载器，避免第二内容包误用默认游戏的图片缓存。
export function assetsFor(gamePack = DEFAULT_GAME_PACK, host = null) {
  const presentationAssets = assetCache(host);
  if (presentationAssets.has(gamePack)) return presentationAssets.get(gamePack);
  const loader = createAssetLoader({
    manifest: gamePack.manifests.assets,
    baseUrl: gamePack.baseUrl ?? import.meta.url,
    adapter: host?.assets,
  });
  const bindings = gamePack.manifests.theme.assetBindings;
  const bundle = Object.freeze({
    loader,
    battleArt: loader.loadImage(bindings.battleBackdrop),
    toolIconAtlas: loader.loadImage(bindings.toolIconAtlas),
    titleMascot: loader.loadImage(bindings.titleMascot),
  });
  presentationAssets.set(gamePack, bundle);
  return bundle;
}

// Jiekou 产物是 4×3 等分透明精灵表；集中裁切避免各渲染模块重复魔数。
export function drawToolAtlasIcon(ctx, slotId, x, y, width, height = width, gamePack = DEFAULT_GAME_PACK, host = null) {
  const { toolIconAtlas: atlas } = assetsFor(gamePack, host);
  if (atlas.status !== 'ready') return false;
  const atlasSpec = gamePack.manifests.theme.toolAtlas ?? {};
  const index = typeof slotId === 'number' ? slotId : atlasSpec.slots?.[slotId];
  if (!Number.isInteger(index) || index < 0) return false;
  const sourceSize = atlasSpec.sourceSize ?? 256;
  const columns = atlasSpec.columns ?? 4;
  const col = index % columns;
  const row = Math.floor(index / columns);
  ctx.drawImage(
    atlas.image,
    col * sourceSize,
    row * sourceSize,
    sourceSize,
    sourceSize,
    x,
    y,
    width,
    height,
  );
  return true;
}

export function getAssetStatus(gamePack = DEFAULT_GAME_PACK, host = null) {
  const bundle = assetsFor(gamePack, host);
  return bundle.loader.status([
    bundle.battleArt.definition.id,
    bundle.toolIconAtlas.definition.id,
    bundle.titleMascot.definition.id,
  ]);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawButton(ctx, rect, label, sub, { active = true, seal = false } = {}, gamePack = DEFAULT_GAME_PACK) {
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  ctx.save();
  ctx.fillStyle = active
    ? seal ? colors.cinnabarAction : colors.paperRaised
    : colors.disabledSurface;
  ctx.shadowColor = active ? 'rgba(42,30,19,0.3)' : 'rgba(42,30,19,0.12)';
  ctx.shadowBlur = tokens.shadows.buttonBlur; ctx.shadowOffsetY = 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = active ? colors.inkStructure : colors.disabledInk;
  ctx.lineWidth = tokens.strokes.default; ctx.stroke();
  ctx.globalAlpha = active ? 0.62 : 0.35;
  ctx.strokeStyle = seal ? colors.paperLight : colors.inkMuted;
  ctx.lineWidth = tokens.strokes.hairline;
  roundRect(ctx, rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, 7); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = active ? seal ? colors.paperLight : colors.inkStrong : colors.disabledInk;
  ctx.font = font(sub ? rect.h * 0.4 : rect.h * 0.45);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h * (sub ? 0.32 : 0.5));
  if (sub) {
    ctx.font = font(rect.h * 0.26, false);
    ctx.fillText(sub, rect.x + rect.w / 2, rect.y + rect.h * 0.72);
  }
  ctx.restore();
}

export function drawStars(ctx, completed, y, size = 24, gamePack = DEFAULT_GAME_PACK) {
  const config = gamePack.config;
  const theme = gamePack.manifests.theme;
  const total = config.campaign.stages.length;
  const gap = size + 7;
  const startX = (config.canvas.w - (total - 1) * gap) / 2;
  ctx.save();
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < completed ? theme.colors.gold : theme.colors.mutedGold;
    ctx.fillText(i < completed ? '★' : '☆', startX + i * gap, y);
  }
  ctx.restore();
}

const fallbackPaperCaches = new WeakMap();
const hostPaperCaches = new WeakMap();

function paperCache(host) {
  if (!host) return fallbackPaperCaches;
  if (!hostPaperCaches.has(host)) hostPaperCaches.set(host, new WeakMap());
  return hostPaperCaches.get(host);
}
function seededRandom(seed = 0x1f2e3d4c) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function paintPaper(paper, width, height, theme) {
  const rand = seededRandom();
  paper.fillStyle = theme.colors.paper;
  paper.fillRect(0, 0, width, height);
  for (let i = 0; i < 900; i++) {
    paper.fillStyle = `rgba(86,76,58,${rand() * 0.035})`;
    paper.fillRect(rand() * width, rand() * height, 1 + rand() * 2, 1);
  }
  for (let i = 0; i < 8; i++) {
    paper.fillStyle = `rgba(85,107,87,${0.018 + rand() * 0.025})`;
    paper.beginPath();
    paper.ellipse(rand() * width, rand() * height, 40 + rand() * 80, 30 + rand() * 50, rand() * 3, 0, Math.PI * 2);
    paper.fill();
  }
}

export function drawPaper(ctx, gamePack = DEFAULT_GAME_PACK, host = null) {
  const config = gamePack.config;
  const theme = gamePack.manifests.theme;
  const caches = paperCache(host);
  let cachedCanvas = caches.get(gamePack);
  if (!cachedCanvas && host?.surface) {
    cachedCanvas = host.surface.createOffscreenCanvas(config.canvas.w, config.canvas.h);
    const paper = cachedCanvas?.getContext?.('2d');
    if (paper) {
      paintPaper(paper, config.canvas.w, config.canvas.h, theme);
      caches.set(gamePack, cachedCanvas);
    } else cachedCanvas = null;
  }
  if (cachedCanvas) ctx.drawImage(cachedCanvas, 0, 0);
  else paintPaper(ctx, config.canvas.w, config.canvas.h, theme);
}

export function drawBattleBackdrop(ctx, gamePack = DEFAULT_GAME_PACK, host = null) {
  const config = gamePack.config;
  const tokens = presentationTokens(gamePack);
  const { battleArt: art } = assetsFor(gamePack, host);
  drawPaper(ctx, gamePack, host);
  if (art.status === 'ready') {
    ctx.save();
    ctx.globalAlpha = tokens.backdrop.artAlpha;
    ctx.drawImage(art.image, 0, 0, config.canvas.w, config.canvas.h);
    const veil = ctx.createLinearGradient(0, 0, 0, config.canvas.h);
    veil.addColorStop(0, tokens.backdrop.veilTop);
    veil.addColorStop(0.5, tokens.backdrop.veilMid);
    veil.addColorStop(1, tokens.backdrop.veilBottom);
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, config.canvas.w, config.canvas.h);
    ctx.restore();
  }
}

export function releasePresentationResources(host) {
  if (!host) return;
  hostPresentationAssets.delete(host);
  hostPaperCaches.delete(host);
}
