// 水墨视觉令牌与素材回退。素材只负责氛围，交互状态仍由 Canvas 绘制。
import { CONFIG } from './config.js';

export const KAI = '"Kaiti SC","STKaiti",KaiTi,"KaiTi SC",serif';
export const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px ${KAI}`;

function loadAsset(path) {
  const image = new Image();
  const asset = { image, status: 'loading', path };
  image.addEventListener('load', () => { asset.status = 'ready'; });
  image.addEventListener('error', () => { asset.status = 'failed'; });
  image.src = new URL(path, import.meta.url).href;
  return asset;
}

export const battleArt = loadAsset('../assets/battlefield-ink-v1.jpg');
export const toolIconAtlas = loadAsset('../assets/tool-icon-atlas-jiekou-v1.png');
export const titleMascot = loadAsset('../assets/title-mascot-jiekou-v1.png');
const assets = [battleArt, toolIconAtlas, titleMascot];

// Jiekou 产物是 4×3 等分透明精灵表；集中裁切避免各渲染模块重复魔数。
export function drawToolAtlasIcon(ctx, index, x, y, width, height = width) {
  if (toolIconAtlas.status !== 'ready') return false;
  const sourceSize = 256;
  const col = index % 4;
  const row = Math.floor(index / 4);
  ctx.drawImage(
    toolIconAtlas.image,
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

export function getAssetStatus() {
  const failed = assets.filter((asset) => asset.status === 'failed').length;
  return {
    ready: assets.every((asset) => asset.status !== 'loading'),
    failed,
  };
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

export function drawButton(ctx, rect, label, sub, { active = true, seal = false } = {}) {
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  const surface = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  surface.addColorStop(0, seal ? '#c94b39' : '#fff8e9');
  surface.addColorStop(1, seal ? '#9d2e25' : '#dfcfb2');
  ctx.fillStyle = surface;
  ctx.shadowColor = 'rgba(49,31,18,0.38)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = seal ? '#7d241b' : '#a89778'; ctx.lineWidth = 2; ctx.stroke();
  ctx.globalAlpha *= 0.55;
  ctx.strokeStyle = seal ? '#f3b9a5' : '#8f7c60'; ctx.lineWidth = 0.8;
  roundRect(ctx, rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, 7); ctx.stroke();
  ctx.globalAlpha = active ? 1 : 0.45;
  ctx.fillStyle = seal ? '#fff6e8' : '#3a3128';
  ctx.font = font(sub ? rect.h * 0.4 : rect.h * 0.45);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h * (sub ? 0.32 : 0.5));
  if (sub) {
    ctx.font = font(rect.h * 0.26, false);
    ctx.fillText(sub, rect.x + rect.w / 2, rect.y + rect.h * 0.72);
  }
  ctx.restore();
}

export function drawStars(ctx, completed, y, size = 24) {
  const total = CONFIG.campaign.stages.length;
  const gap = size + 7;
  const startX = (CONFIG.canvas.w - (total - 1) * gap) / 2;
  ctx.save();
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < completed ? '#d8a61f' : '#77694f';
    ctx.fillText(i < completed ? '★' : '☆', startX + i * gap, y);
  }
  ctx.restore();
}

let paperCache = null;
function seededRandom(seed = 0x1f2e3d4c) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export function drawPaper(ctx) {
  if (!paperCache) {
    const rand = seededRandom();
    paperCache = document.createElement('canvas');
    paperCache.width = CONFIG.canvas.w;
    paperCache.height = CONFIG.canvas.h;
    const paper = paperCache.getContext('2d');
    paper.fillStyle = '#e6d9c3';
    paper.fillRect(0, 0, paperCache.width, paperCache.height);
    for (let i = 0; i < 900; i++) {
      paper.fillStyle = `rgba(120,100,70,${rand() * 0.055})`;
      paper.fillRect(rand() * CONFIG.canvas.w, rand() * CONFIG.canvas.h, 1 + rand() * 2, 1);
    }
    for (let i = 0; i < 8; i++) {
      paper.fillStyle = `rgba(150,130,100,${0.035 + rand() * 0.04})`;
      paper.beginPath();
      paper.ellipse(rand() * CONFIG.canvas.w, rand() * CONFIG.canvas.h, 40 + rand() * 80, 30 + rand() * 50, rand() * 3, 0, Math.PI * 2);
      paper.fill();
    }
  }
  ctx.drawImage(paperCache, 0, 0);
}

export function drawBattleBackdrop(ctx) {
  drawPaper(ctx);
  if (battleArt.status === 'ready') {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(battleArt.image, 0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
    const veil = ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.h);
    veil.addColorStop(0, 'rgba(238,226,201,0.42)');
    veil.addColorStop(0.5, 'rgba(232,218,193,0.22)');
    veil.addColorStop(1, 'rgba(225,208,180,0.36)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
    ctx.restore();
  }
}
