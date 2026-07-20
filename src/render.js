// 渲染编排：棋盘、字牌、敌人、特效与战斗 UI。
import { B, UI, boardHeight, boardWidth, cellXY } from './ui-layout.js';
import {
  drawBattleBackdrop, drawButton, drawStars, drawToolAtlasIcon, font,
  presentationTokens, roundRect, themeColors,
} from './render-theme.js';
import { drawBattleSignals, drawTopBar } from './render-battle-hud.js';
import { drawBattleControls } from './render-battle-controls.js';
import { drawEnemies } from './render-enemies.js';
import { drawTitle } from './render-title.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { copyText, gamePackFor, hostFor, registryFor } from './engine-core/public.js';
import {
  createEffectRendererRegistry,
  createHeroPresentationRegistry,
} from './presentation-pack/presentation-registry.js';
import { drawRouteOverlay } from './presentation-pack/route-overlay.js';
import { drawBoardInteractionOverlay } from './presentation-pack/board-interaction-overlay.js';

// ---------- 字牌 ----------
function drawCard(ctx, x, y, size, { char, level, style, shake = 0, height = size, palette }, gamePack) {
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  const w = size;
  const h = height;
  const halfW = w / 2;
  const halfH = h / 2;
  ctx.save();
  const shakeOffset = shake > 0 ? Math.sin(x * 0.37 + y * 0.19 + shake * 113) * 2 : 0;
  ctx.translate(x + shakeOffset, y);
  ctx.shadowColor = 'rgba(39,31,21,0.34)';
  ctx.shadowBlur = tokens.shadows.cardBlur; ctx.shadowOffsetY = tokens.shadows.cardOffsetY;
  const bg = style === 'frag' ? '#f7ecd2' : style === 'hero' ? (palette?.paper ?? colors.paperLight) : colors.paperLight;
  const paper = ctx.createLinearGradient(0, -halfH, 0, halfH);
  paper.addColorStop(0, colors.paperRaised);
  paper.addColorStop(1, bg);
  ctx.fillStyle = paper;
  // 轻微不齐的四角和双墨线，比圆润卡片更接近手裁纸牌。
  ctx.beginPath();
  ctx.moveTo(-halfW + 1, -halfH + 2);
  ctx.lineTo(halfW - 2, -halfH);
  ctx.lineTo(halfW, halfH - 2);
  ctx.lineTo(-halfW + 2, halfH);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = style === 'hero' ? tokens.strokes.strong : tokens.strokes.default;
  ctx.strokeStyle = style === 'frag' ? colors.inkMuted : style === 'hero' ? colors.goldReward : colors.cardBorder;
  ctx.stroke();
  ctx.globalAlpha = style === 'hero' ? 0.72 : 0.24;
  ctx.strokeStyle = style === 'hero' ? (palette?.accent ?? colors.goldReward) : colors.inkMuted;
  ctx.lineWidth = tokens.strokes.hairline;
  ctx.beginPath();
  ctx.moveTo(-halfW + 5, halfH - 4);
  ctx.lineTo(halfW - 5, halfH - 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = style === 'hero' ? (palette?.ink ?? colors.inkStrong) : colors.inkStrong;
  ctx.font = font(Math.min(w, h) * 0.7);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 2);
  if (level) {
    const badgeRadius = Math.max(6, Math.min(w, h) * 0.15);
    ctx.fillStyle = style === 'hero' ? colors.goldReward : colors.inkStructure;
    ctx.beginPath(); ctx.arc(halfW - badgeRadius - 2, -halfH + badgeRadius + 2, badgeRadius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = style === 'hero' ? colors.inkStrong : colors.paperRaised;
    ctx.font = font(Math.max(10, Math.min(w, h) * 0.24));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(level), halfW - badgeRadius - 2, -halfH + badgeRadius + 2.5);
  }
  ctx.restore();
}

// 小武器只做英雄身份提示，避免把以汉字为核心的棋盘变成角色立绘。
function drawHeroWeapon(ctx, rendererId, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.42);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,248,224,0.9)';
  ctx.shadowBlur = 2;

  if (rendererId === 'weapon.double-swords') {
    ctx.strokeStyle = '#5d3b21'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(10, 7); ctx.moveTo(-10, 7); ctx.lineTo(10, -7); ctx.stroke();
    ctx.strokeStyle = '#d8d5c4'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(10, 7); ctx.moveTo(-7, 5); ctx.lineTo(10, -7); ctx.stroke();
    ctx.fillStyle = '#80602b';
    ctx.fillRect(-11, -8, 5, 2); ctx.fillRect(-11, 6, 5, 2);
  } else if (rendererId === 'weapon.bow') {
    ctx.strokeStyle = '#71431f'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-8, -9); ctx.quadraticCurveTo(4, 0, -8, 9); ctx.stroke();
    ctx.strokeStyle = '#d4c8a6'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.stroke();
    ctx.strokeStyle = '#35302b'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(11, 0); ctx.stroke();
    ctx.fillStyle = '#35302b'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(6, -2.7); ctx.lineTo(6, 2.7); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = '#5a3d25'; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(-12, 7); ctx.lineTo(8, -6); ctx.stroke();
    ctx.strokeStyle = '#b49358'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-12, 7); ctx.lineTo(8, -6); ctx.stroke();
    if (rendererId === 'weapon.guandao') {
      ctx.fillStyle = '#d9d6c5'; ctx.strokeStyle = '#3f443f'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(6, -7); ctx.quadraticCurveTo(14, -12, 12, -2); ctx.quadraticCurveTo(8, 0, 5, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#a12f27'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(1, -10); ctx.moveTo(5, -4); ctx.lineTo(0, 1); ctx.stroke();
    } else {
      ctx.fillStyle = rendererId === 'weapon.spear' ? '#dcebf0' : '#53545a';
      ctx.strokeStyle = '#343638'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (rendererId === 'weapon.serpent-spear') {
        ctx.moveTo(7, -7); ctx.lineTo(13, -10); ctx.lineTo(11, -5); ctx.lineTo(15, -3); ctx.lineTo(8, -3);
      } else {
        ctx.moveTo(7, -7); ctx.lineTo(15, -8); ctx.lineTo(10, -2); ctx.lineTo(6, -3);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#a82e27'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(1, -9); ctx.moveTo(6, -4); ctx.lineTo(0, 0); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- 棋盘 ----------
function drawBoard(ctx, state, drag, gamePack) {
  const config = gamePack.config;
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  const heroVisuals = gamePack.manifests.theme.heroVisuals ?? {};
  const defaultHeroPresentations = createHeroPresentationRegistry(gamePack.manifests.theme);
  ctx.save();
  ctx.shadowColor = 'rgba(31,27,20,0.34)';
  ctx.shadowBlur = tokens.shadows.boardBlur;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = colors.boardSurface;
  roundRect(ctx, B.ox - 9, B.oy - 9, boardWidth + 18, boardHeight + 18, 4);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.restore();
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const cell = state.grid[r][c];
      const x = B.ox + c * B.cellW;
      const y = B.oy + r * B.cellH;
      if (cell.type === 'path' || cell.type === 'spawn') {
        ctx.fillStyle = colors.pathCell ?? 'rgba(200,174,164,0.92)';
        ctx.fillRect(x, y, B.cellW, B.cellH);
        ctx.strokeStyle = 'rgba(83,61,50,0.18)'; ctx.lineWidth = tokens.strokes.hairline;
        ctx.beginPath(); ctx.moveTo(x + 4, y + B.cellH - 10); ctx.quadraticCurveTo(x + 19, y + 26, x + 37, y + 31); ctx.stroke();
        ctx.fillStyle = 'rgba(80,58,38,0.2)';
        ctx.beginPath(); ctx.arc(x + 12, y + 23, 2, 0, Math.PI * 2); ctx.arc(x + 31, y + 14, 1.7, 0, Math.PI * 2); ctx.fill();
      } else if (cell.type === 'locked') {
        ctx.fillStyle = colors.lockedCell ?? 'rgba(156,196,184,0.9)';
        ctx.fillRect(x + 1, y + 1, B.cellW - 2, B.cellH - 2);
        ctx.strokeStyle = 'rgba(33,37,32,0.3)'; ctx.lineWidth = tokens.strokes.hairline;
        for (let k = 0; k < 3; k++) {
          const gx = x + 10 + ((r * 13 + c * 7 + k * 11) % 25);
          const gy = y + 34 - k * 6;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 3, gy - 8); ctx.moveTo(gx, gy); ctx.lineTo(gx + 3, gy - 7); ctx.stroke();
        }
      } else if (cell.type === 'open') {
        ctx.fillStyle = colors.openCell ?? 'rgba(248,244,233,0.96)';
        ctx.fillRect(x + 1, y + 1, B.cellW - 2, B.cellH - 2);
        ctx.strokeStyle = 'rgba(43,91,70,0.34)';
        ctx.strokeRect(x + 1.5, y + 1.5, B.cellW - 3, B.cellH - 3);
        ctx.fillStyle = 'rgba(43,91,70,0.13)';
        ctx.fillRect(x + 7 + ((r + c) % 4) * 5, y + 9 + ((r * 3 + c) % 5) * 4, 8, 1);
      } else if (cell.type === 'rock') {
        ctx.fillStyle = 'rgba(205,191,166,0.9)';
        ctx.fillRect(x, y, B.cellW, B.cellH);
        ctx.fillStyle = '#4d4d48';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 37); ctx.lineTo(x + 12, y + 18); ctx.lineTo(x + 23, y + 8);
        ctx.lineTo(x + 36, y + 19); ctx.lineTo(x + 39, y + 38); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(235,225,204,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 15, y + 18); ctx.lineTo(x + 24, y + 13); ctx.lineTo(x + 31, y + 20); ctx.stroke();
      } else if (cell.type === 'gate') {
        // 两条路线各有一座营门，但共享顶部唯一的“阿斗”命数。
        ctx.fillStyle = 'rgba(226,210,180,0.97)';
        ctx.fillRect(x, y, B.cellW, B.cellH);
        ctx.fillStyle = '#733426';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 14); ctx.lineTo(x + B.cellW / 2, y + 3); ctx.lineTo(x + B.cellW - 4, y + 14);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9f5540';
        roundRect(ctx, x + 8, y + 13, B.cellW - 16, B.cellH - 17, 2); ctx.fill();
        ctx.strokeStyle = '#4f2b21'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff0cf'; ctx.font = font(21);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(copyText(gamePack, 'battle.gate'), x + B.cellW / 2, y + B.cellH / 2 + 5);
      }
      if (cell.type === 'spawn' || cell.decoration === 'bramble') {
        // 两路曹军入口使用参考图的黑墨荆棘，不用角色立绘占据格面。
        ctx.save();
        ctx.translate(x + B.cellW / 2, y + B.cellH / 2 + 4);
        ctx.fillStyle = '#282824';
        ctx.strokeStyle = '#11110f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-18, 16); ctx.lineTo(-15, -8); ctx.lineTo(-8, 0); ctx.lineTo(-4, -18);
        ctx.lineTo(2, -4); ctx.lineTo(10, -16); ctx.lineTo(12, 2); ctx.lineTo(19, -7);
        ctx.lineTo(17, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8a8980'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-12, 11); ctx.lineTo(-3, -3); ctx.moveTo(2, 11); ctx.lineTo(10, -4); ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = colors.cellLine;
      ctx.lineWidth = tokens.strokes.hairline;
      ctx.strokeRect(x + 0.4, y + 0.4, B.cellW - 0.8, B.cellH - 0.8);
    }
  }
  drawRouteOverlay(ctx, state, gamePack);
  // 棋盘外框
  ctx.strokeStyle = colors.boardFrame; ctx.lineWidth = tokens.strokes.strong;
  ctx.strokeRect(B.ox - 2, B.oy - 2, boardWidth + 4, boardHeight + 4);

  drawBoardInteractionOverlay(ctx, state, drag, gamePack);

  // 格上单位
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const u = state.grid[r][c].unit;
      if (!u) continue;
      const { x, y } = cellXY(r, c);
      const sourceGhost = drag?.item && drag.source?.zone === 'grid'
        && drag.source.r === r && drag.source.c === c;
      if (sourceGhost) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = colors.swapTarget ?? '#287eaa';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - B.cellW / 2 + 4, y - B.cellH / 2 + 4, B.cellW - 8, B.cellH - 8);
        ctx.setLineDash([]);
      }
      if (u.kind === 'troop') drawCard(ctx, x, y, B.cellW - 5, { char: config.troops[u.type].char, level: u.level, style: 'troop', shake: u.flash, height: B.cellH - 5 }, gamePack);
      else if (u.kind === 'frag') drawCard(ctx, x, y, B.cellW - 5, { char: u.char, level: u.level ?? 1, style: 'frag', height: B.cellH - 5 }, gamePack);
      if (sourceGhost) ctx.restore();
    }
  }
  // 英雄保持“双格彩色姓名牌”，局部光晕不越过周边棋格抢占战场。
  for (const h of state.heroes) {
    const cfg = config.heroes[h.key];
    const a = cellXY(h.r, h.c);
    const presentation = registryFor(state, 'heroPresentations', defaultHeroPresentations).get(cfg.renderId);
    const visual = heroVisuals[cfg.renderId];
    const centerX = a.x + B.cellW / 2;
    ctx.save();
    const halo = ctx.createRadialGradient(centerX, a.y, 3, centerX, a.y, 48);
    halo.addColorStop(0, visual.glow);
    halo.addColorStop(0.62, visual.glow);
    halo.addColorStop(1, 'rgba(255,236,142,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(centerX, a.y, 50, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = visual.glow; ctx.shadowBlur = 7;
    drawCard(ctx, a.x, a.y, B.cellW - 3, { char: cfg.chars[0], level: h.level ?? 1, style: 'hero', shake: h.flash, height: B.cellH - 3, palette: visual }, gamePack);
    drawCard(ctx, a.x + B.cellW, a.y, B.cellW - 3, { char: cfg.chars[1], level: h.level ?? 1, style: 'hero', shake: h.flash, height: B.cellH - 3, palette: visual }, gamePack);
    ctx.shadowColor = 'transparent';
    drawHeroWeapon(ctx, presentation.weaponRendererId, a.x + B.cellW + 9, a.y + 11);
    ctx.restore();
  }
}

// ---------- 特效 ----------
// 火龙由火焰身段、分岔火尾和简化龙首组成，不用文字代替形象。
function drawFlameDragon(ctx, x, y, angle, phase, alpha) {
  const sway = Math.sin(phase * 17) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(239,88,18,0.82)';
  ctx.shadowBlur = 9;
  const body = new Path2D();
  body.moveTo(-43, sway);
  body.bezierCurveTo(-30, -13 - sway, -12, 12 + sway, 8, 0);
  ctx.strokeStyle = '#b92f12'; ctx.lineWidth = 13; ctx.stroke(body);
  ctx.strokeStyle = '#f06a1c'; ctx.lineWidth = 8; ctx.stroke(body);
  ctx.strokeStyle = '#ffd45d'; ctx.lineWidth = 3; ctx.stroke(body);
  ctx.strokeStyle = '#ef5b18'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-24, -5); ctx.quadraticCurveTo(-38, -18 - sway, -50, -10);
  ctx.moveTo(-27, 5); ctx.quadraticCurveTo(-40, 17 + sway, -51, 9);
  ctx.stroke();
  ctx.fillStyle = '#ed641b';
  ctx.beginPath();
  ctx.moveTo(4, -7); ctx.quadraticCurveTo(13, -12, 19, -5);
  ctx.lineTo(28, -2); ctx.lineTo(19, 4); ctx.quadraticCurveTo(11, 10, 3, 5);
  ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffbd3f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, -7); ctx.lineTo(12, -14); ctx.moveTo(14, -7); ctx.lineTo(19, -12); ctx.stroke();
  ctx.fillStyle = '#2c190f'; ctx.beginPath(); ctx.arc(17, -3, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// 箭头、箭羽和箭杆一起绘制，确保箭雨与普通弹道都是可辨识的真实箭支。
function drawArrow(ctx, x, y, angle, length = 22, alpha = 1) {
  const half = length / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#493525'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-half, 0); ctx.lineTo(half - 3, 0); ctx.stroke();
  ctx.fillStyle = '#272621';
  ctx.beginPath(); ctx.moveTo(half, 0); ctx.lineTo(half - 5, -3); ctx.lineTo(half - 5, 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#87633c'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-half + 4, 0); ctx.lineTo(-half, -3.5);
  ctx.moveTo(-half + 4, 0); ctx.lineTo(-half, 3.5);
  ctx.stroke();
  ctx.restore();
}

const EFFECT_RENDERERS = createEffectRendererRegistry({
  'effect.ink-splash': ({ ctx, f, k }) => {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 0.5 * k;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + f.t * 2), 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
  },
  'effect.floating-text': ({ ctx, f, k }) => {
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = f.color;
      ctx.font = font(Math.max(15, 15 * f.scale));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(247,238,216,0.92)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
  },
  'effect.ink-slash': ({ ctx, f, k }) => {
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(f.ang);
      ctx.strokeStyle = `rgba(40,30,20,${k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, 6); ctx.quadraticCurveTo(0, -10, 14, 6); ctx.stroke();
      ctx.restore();
  },
  'effect.expanding-ring': ({ ctx, f, k }) => {
      ctx.strokeStyle = f.color; ctx.globalAlpha = k; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.maxR * (1 - k), 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
  },
  'effect.flame-dragon': ({ ctx, f, k, state }) => {
      const path = state.paths?.[f.lane ?? 0] ?? state.path;
      const i = Math.min(Math.floor(f.p), path.length - 2);
      if (i >= 0) {
        const fr = Math.min(f.p - i, 1);
        const a = cellXY(path[i].r, path[i].c);
        const b = cellXY(path[i + 1].r, path[i + 1].c);
        const x = a.x + (b.x - a.x) * fr, y = a.y + (b.y - a.y) * fr;
        drawFlameDragon(ctx, x, y, Math.atan2(b.y - a.y, b.x - a.x), f.t, k);
      }
  },
  'effect.arrow-rain': ({ ctx, f, k }) => {
      for (let i = 0; i < 30; i++) {
        const x = (i * 137) % boardWidth + B.ox;
        const y = B.oy - 28 + ((i * 89 + f.t * 520) % (boardHeight + 56));
        drawArrow(ctx, x, y, Math.PI / 2 + 0.18 + (i % 3 - 1) * 0.04, 18 + i % 4 * 2, k * 0.88);
      }
  },
});

function drawEffects(ctx, state, gamePack) {
  const bindings = gamePack.manifests.theme.renderers.effects;
  for (const f of state.effects) {
    if (f.t < 0) continue;
    const k = 1 - f.t / f.life;
    const effectId = f.effectId ?? `effect.${f.kind}`;
    const rendererId = bindings[effectId];
    EFFECT_RENDERERS.get(rendererId)({ ctx, f, k, state });
  }
  // 弓箭弹道
  for (const p of state.projectiles) {
    drawArrow(ctx, p.x, p.y, p.ang || 0, 18);
  }
}

function drawOverlay(ctx, state, gamePack) {
  const config = gamePack.config;
  const copy = (id, values, fallback) => copyText(gamePack, id, values, fallback);
  const colors = themeColors(gamePack);
  ctx.fillStyle = 'rgba(23,25,20,0.74)';
  ctx.fillRect(0, 0, config.canvas.w, config.canvas.h);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.48)'; ctx.shadowBlur = 22;
  ctx.fillStyle = colors.paperRaised;
  roundRect(ctx, 46, 190, 328, 380, 6); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = colors.inkStructure; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = state.win ? colors.goldReward : colors.cinnabarPrimary; ctx.lineWidth = 1;
  roundRect(ctx, 52, 196, 316, 368, 3); ctx.stroke();
  ctx.fillStyle = state.win ? 'rgba(223,169,31,0.16)' : 'rgba(49,43,35,0.13)';
  ctx.beginPath(); ctx.arc(210, 278, 66, 0, Math.PI * 2); ctx.fill();
  if (state.win) {
    ctx.save();
    ctx.strokeStyle = colors.goldReward;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(210, 278, 76, 0, Math.PI * 2); ctx.stroke();
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(210 + Math.cos(angle) * 82, 278 + Math.sin(angle) * 82);
      ctx.lineTo(210 + Math.cos(angle) * 94, 278 + Math.sin(angle) * 94);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = state.win ? colors.cinnabarPrimary : colors.inkStrong;
  ctx.font = font(64);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(copy(state.win ? 'result.victory' : 'result.defeat'), 210, 278);
  ctx.font = font(18, false);
  ctx.fillText(state.win
    ? copy('result.victory.summary', { stageName: state.stage.name, kills: state.stats.kills })
    : copy('result.defeat.summary', { wave: state.wave, kills: state.stats.kills }), 210, 358);
  ctx.font = font(14, false);
  ctx.fillText(`${config.campaign.rank} · ${state.clearedStars}/${config.campaign.stages.length} 星`, 210, 398);
  drawStars(ctx, state.clearedStars, 432, 25, gamePack);
  if (state.saveWarning) {
    ctx.fillStyle = '#8f3a2d'; ctx.font = font(11, false);
    ctx.fillText(copy('result.storageWarning'), 210, 470);
  }

  const hasNext = state.win && state.stageIndex < config.campaign.stages.length - 1;
  const complete = state.win && !hasNext;
  const label = hasNext ? copy('result.next') : complete ? copy('result.complete') : copy('result.retry');
  const sub = hasNext ? `${config.campaign.rank} · 第 ${state.stageIndex + 2} 关`
    : complete ? `${config.campaign.rank} · 五星` : `重试第 ${state.stageIndex + 1} 关`;
  drawButton(ctx, UI.restart, label, sub, { seal: true }, gamePack);
  ctx.restore();
}

export function render(
  ctx,
  state,
  drag,
  gamePack = gamePackFor(state, DEFAULT_GAME_PACK),
  host = hostFor(state),
) {
  const config = gamePack.config;
  const copy = (id, values, fallback) => copyText(gamePack, id, values, fallback);
  if (state.title) { drawTitle(ctx, state, gamePack, host); return; }
  drawBattleBackdrop(ctx, gamePack, host);
  drawTopBar(ctx, state, gamePack, host);
  drawBoard(ctx, state, drag, gamePack);
  drawEnemies(ctx, state, gamePack);
  drawEffects(ctx, state, gamePack);
  drawBattleControls(ctx, state, drag, (...args) => drawCard(...args, gamePack), gamePack, host);
  // 铲子模式提示
  if (drag?.mode === 'brush') {
    ctx.fillStyle = themeColors(gamePack).qingPlayable; ctx.font = font(12);
    ctx.textAlign = 'center';
    ctx.fillText(copy('battle.brush.hint'), 210, 600);
  } else if (drag?.mode === 'shovel' || drag?.item?.kind === 'shovel') {
    ctx.fillStyle = themeColors(gamePack).qingPlayable; ctx.font = font(12);
    ctx.textAlign = 'center';
    ctx.fillText(copy('battle.shovel.hint'), 210, 600);
  }
  drawBattleSignals(ctx, state, gamePack);

  // 拖拽跟随
  if (drag?.item) {
    if (drag.item.kind === 'troop') drawCard(ctx, drag.x, drag.y, 46, { char: config.troops[drag.item.type].char, level: drag.item.level, style: 'troop' }, gamePack);
    else if (drag.item.kind === 'frag') drawCard(ctx, drag.x, drag.y, 46, { char: drag.item.char, level: drag.item.level ?? 1, style: 'frag' }, gamePack);
    else drawToolAtlasIcon(ctx, 'item.shovel', drag.x - 24, drag.y - 24, 48, 48, gamePack, host);
  }

  if (state.over) drawOverlay(ctx, state, gamePack);
}
