// 渲染编排：棋盘、字牌、敌人、特效与战斗 UI。
import { CONFIG } from './config.js';
import { canMerge } from './logic.js';
import { B, UI, boardHeight, boardWidth, cellXY } from './ui-layout.js';
import { drawBattleBackdrop, drawButton, drawStars, drawToolAtlasIcon, font, roundRect } from './render-theme.js';
import { drawBattleSignals, drawTopBar } from './render-battle-hud.js';
import { drawBattleControls } from './render-battle-controls.js';
import { drawEnemies } from './render-enemies.js';
import { drawTitle } from './render-title.js';

// 武将仍以双格姓名为主视觉，颜色只用于快速辨识阵营单位。
const HERO_VISUALS = {
  liubei:     { paper: '#f3e4bd', accent: '#b8842f', ink: '#7b4f14', glow: 'rgba(220,169,62,0.36)' },
  guanyu:     { paper: '#dfe8d0', accent: '#4d7449', ink: '#285432', glow: 'rgba(76,132,74,0.32)' },
  zhangfei:   { paper: '#eadced', accent: '#815783', ink: '#65316d', glow: 'rgba(143,82,151,0.32)' },
  zhaoyun:    { paper: '#dbe8ed', accent: '#547e95', ink: '#2e647f', glow: 'rgba(76,142,176,0.34)' },
  huangzhong: { paper: '#f1dfc5', accent: '#ad7631', ink: '#94601e', glow: 'rgba(218,146,51,0.34)' },
};

// ---------- 字牌 ----------
function drawCard(ctx, x, y, size, { char, level, style, shake = 0, height = size, palette }) {
  const w = size;
  const h = height;
  const halfW = w / 2;
  const halfH = h / 2;
  ctx.save();
  ctx.translate(x + (Math.random() * 2 - 1) * (shake > 0 ? 2 : 0), y);
  ctx.shadowColor = 'rgba(45,31,18,0.3)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
  const bg = style === 'frag' ? '#f7ecd2' : style === 'hero' ? (palette?.paper ?? '#f5e3b0') : '#f6f1e4';
  const paper = ctx.createLinearGradient(0, -halfH, 0, halfH);
  paper.addColorStop(0, '#fffaf0');
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
  ctx.lineWidth = style === 'hero' ? 2.5 : 1.4;
  ctx.strokeStyle = style === 'frag' ? '#8b58ad' : style === 'hero' ? (palette?.accent ?? '#d39b16') : '#837967';
  ctx.stroke();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = style === 'hero' ? (palette?.accent ?? '#9b6711') : '#8f7d62';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-halfW + 3.5, -halfH + 3.5, w - 7, h - 7);
  ctx.globalAlpha = 1;
  ctx.fillStyle = style === 'hero' ? (palette?.ink ?? '#8a5a00') : '#1f1c18';
  ctx.font = font(Math.min(w, h) * 0.7);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 2);
  if (level) {
    ctx.fillStyle = '#1d1915';
    ctx.font = font(Math.max(9, Math.min(w, h) * 0.24));
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(String(level), halfW - 3, -halfH + 1);
  }
  ctx.restore();
}

// 小武器只做英雄身份提示，避免把以汉字为核心的棋盘变成角色立绘。
function drawHeroWeapon(ctx, key, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.42);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,248,224,0.9)';
  ctx.shadowBlur = 2;

  if (key === 'liubei') {
    ctx.strokeStyle = '#5d3b21'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(10, 7); ctx.moveTo(-10, 7); ctx.lineTo(10, -7); ctx.stroke();
    ctx.strokeStyle = '#d8d5c4'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(10, 7); ctx.moveTo(-7, 5); ctx.lineTo(10, -7); ctx.stroke();
    ctx.fillStyle = '#80602b';
    ctx.fillRect(-11, -8, 5, 2); ctx.fillRect(-11, 6, 5, 2);
  } else if (key === 'huangzhong') {
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
    if (key === 'guanyu') {
      ctx.fillStyle = '#d9d6c5'; ctx.strokeStyle = '#3f443f'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(6, -7); ctx.quadraticCurveTo(14, -12, 12, -2); ctx.quadraticCurveTo(8, 0, 5, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#a12f27'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(1, -10); ctx.moveTo(5, -4); ctx.lineTo(0, 1); ctx.stroke();
    } else {
      ctx.fillStyle = key === 'zhaoyun' ? '#dcebf0' : '#53545a';
      ctx.strokeStyle = '#343638'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (key === 'zhangfei') {
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
function drawBoard(ctx, state, drag) {
  ctx.save();
  ctx.shadowColor = 'rgba(37,28,18,0.42)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(221,208,188,0.96)';
  roundRect(ctx, B.ox - 9, B.oy - 9, boardWidth + 18, boardHeight + 18, 4);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#5c5145';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const cell = state.grid[r][c];
      const x = B.ox + c * B.cellW;
      const y = B.oy + r * B.cellH;
      if (cell.type === 'path' || cell.type === 'spawn') {
        ctx.fillStyle = 'rgba(200,174,164,0.92)';
        ctx.fillRect(x, y, B.cellW, B.cellH);
        ctx.strokeStyle = 'rgba(83,61,50,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 4, y + B.cellH - 10); ctx.quadraticCurveTo(x + 19, y + 26, x + 37, y + 31); ctx.stroke();
        ctx.fillStyle = 'rgba(80,58,38,0.2)';
        ctx.beginPath(); ctx.arc(x + 12, y + 23, 2, 0, Math.PI * 2); ctx.arc(x + 31, y + 14, 1.7, 0, Math.PI * 2); ctx.fill();
      } else if (cell.type === 'locked') {
        ctx.fillStyle = 'rgba(156,196,184,0.9)';
        ctx.fillRect(x + 1, y + 1, B.cellW - 2, B.cellH - 2);
        ctx.strokeStyle = 'rgba(48,78,65,0.28)'; ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const gx = x + 10 + ((r * 13 + c * 7 + k * 11) % 25);
          const gy = y + 34 - k * 6;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 3, gy - 8); ctx.moveTo(gx, gy); ctx.lineTo(gx + 3, gy - 7); ctx.stroke();
        }
      } else if (cell.type === 'open') {
        ctx.fillStyle = 'rgba(248,244,233,0.96)';
        ctx.fillRect(x + 1, y + 1, B.cellW - 2, B.cellH - 2);
        ctx.strokeStyle = 'rgba(126,103,73,0.42)';
        ctx.strokeRect(x + 1.5, y + 1.5, B.cellW - 3, B.cellH - 3);
        ctx.fillStyle = 'rgba(105,82,55,0.13)';
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
        ctx.fillText('营', x + B.cellW / 2, y + B.cellH / 2 + 5);
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
      ctx.strokeStyle = 'rgba(73,62,52,0.23)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + 0.4, y + 0.4, B.cellW - 0.8, B.cellH - 0.8);
    }
  }
  // 棋盘外框
  ctx.strokeStyle = '#211e1a'; ctx.lineWidth = 3;
  ctx.strokeRect(B.ox - 2, B.oy - 2, boardWidth + 4, boardHeight + 4);
  ctx.strokeStyle = 'rgba(245,235,215,0.72)'; ctx.lineWidth = 1;
  ctx.strokeRect(B.ox + 2, B.oy + 2, boardWidth - 4, boardHeight - 4);

  // 拖拽/铲子模式高亮
  if (drag?.item || drag?.mode === 'shovel' || drag?.mode === 'brush') {
    const d = drag;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 6);
    for (let r = 0; r < B.rows; r++) {
      for (let c = 0; c < B.cols; c++) {
        const cell = state.grid[r][c];
        const x = B.ox + c * B.cellW, y = B.oy + r * B.cellH;
        if (d.mode === 'brush') {
          if (['troop', 'frag'].includes(cell.unit?.kind)) {
            ctx.strokeStyle = `rgba(112,66,139,${0.45 + pulse * 0.5})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 3, y + 3, B.cellW - 6, B.cellH - 6);
          }
        } else if (d.mode === 'shovel') {
          if (cell.type === 'locked') {
            ctx.strokeStyle = `rgba(58,107,53,${0.4 + pulse * 0.5})`;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 3, y + 3, B.cellW - 6, B.cellH - 6);
          }
        } else if (d.item?.kind === 'shovel') {
          if (cell.type === 'locked') {
            ctx.strokeStyle = `rgba(184,128,25,${0.45 + pulse * 0.5})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 3, y + 3, B.cellW - 6, B.cellH - 6);
          }
        } else if (d.item) {
          if (cell.type === 'open' && !cell.unit) {           // 可落格:绿
            ctx.fillStyle = `rgba(90,150,90,${0.15 + pulse * 0.15})`;
            ctx.fillRect(x + 2, y + 2, B.cellW - 4, B.cellH - 4);
          } else if (cell.unit && canMerge(cell.unit, d.item)) { // 可合成:金框
            ctx.strokeStyle = `rgba(200,149,26,${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 2, y + 2, B.cellW - 4, B.cellH - 4);
          }
        }
      }
    }
  }

  // 格上单位
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const u = state.grid[r][c].unit;
      if (!u) continue;
      const { x, y } = cellXY(r, c);
      if (u.kind === 'troop') drawCard(ctx, x, y, B.cellW - 5, { char: CONFIG.troops[u.type].char, level: u.level, style: 'troop', shake: u.flash, height: B.cellH - 5 });
      else if (u.kind === 'frag') drawCard(ctx, x, y, B.cellW - 5, { char: u.char, level: u.level ?? 1, style: 'frag', height: B.cellH - 5 });
    }
  }
  // 英雄保持“双格彩色姓名牌”，局部光晕不越过周边棋格抢占战场。
  for (const h of state.heroes) {
    const cfg = CONFIG.heroes[h.key];
    const a = cellXY(h.r, h.c);
    const visual = HERO_VISUALS[h.key] ?? HERO_VISUALS.zhaoyun;
    const centerX = a.x + B.cellW / 2;
    ctx.save();
    const halo = ctx.createRadialGradient(centerX, a.y, 3, centerX, a.y, 48);
    halo.addColorStop(0, visual.glow);
    halo.addColorStop(0.62, visual.glow);
    halo.addColorStop(1, 'rgba(255,236,142,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(centerX, a.y, 50, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = visual.glow; ctx.shadowBlur = 7;
    drawCard(ctx, a.x, a.y, B.cellW - 3, { char: cfg.chars[0], level: h.level ?? 1, style: 'hero', shake: h.flash, height: B.cellH - 3, palette: visual });
    drawCard(ctx, a.x + B.cellW, a.y, B.cellW - 3, { char: cfg.chars[1], level: h.level ?? 1, style: 'hero', shake: h.flash, height: B.cellH - 3, palette: visual });
    ctx.shadowColor = 'transparent';
    drawHeroWeapon(ctx, h.key, a.x + B.cellW + 9, a.y + 11);
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

function drawEffects(ctx, state) {
  for (const f of state.effects) {
    const k = 1 - f.t / f.life;
    if (f.kind === 'ink') {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 0.5 * k;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + f.t * 2), 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (f.kind === 'text') {
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = f.color;
      ctx.font = font(Math.max(15, 15 * f.scale));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(247,238,216,0.92)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'slash') {
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(f.ang);
      ctx.strokeStyle = `rgba(40,30,20,${k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, 6); ctx.quadraticCurveTo(0, -10, 14, 6); ctx.stroke();
      ctx.restore();
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = f.color; ctx.globalAlpha = k; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.maxR * (1 - k), 0, 6.29); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.kind === 'dragon') {
      const path = state.paths?.[f.lane ?? 0] ?? state.path;
      const i = Math.min(Math.floor(f.p), path.length - 2);
      if (i >= 0) {
        const fr = Math.min(f.p - i, 1);
        const a = cellXY(path[i].r, path[i].c);
        const b = cellXY(path[i + 1].r, path[i + 1].c);
        const x = a.x + (b.x - a.x) * fr, y = a.y + (b.y - a.y) * fr;
        drawFlameDragon(ctx, x, y, Math.atan2(b.y - a.y, b.x - a.x), f.t, k);
      }
    } else if (f.kind === 'rain') {
      for (let i = 0; i < 30; i++) {
        const x = (i * 137) % boardWidth + B.ox;
        const y = B.oy - 28 + ((i * 89 + f.t * 520) % (boardHeight + 56));
        drawArrow(ctx, x, y, Math.PI / 2 + 0.18 + (i % 3 - 1) * 0.04, 18 + i % 4 * 2, k * 0.88);
      }
    }
  }
  // 弓箭弹道
  for (const p of state.projectiles) {
    drawArrow(ctx, p.x, p.y, p.ang || 0, 18);
  }
}

function drawOverlay(ctx, state) {
  ctx.fillStyle = 'rgba(24,19,13,0.78)';
  ctx.fillRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.48)'; ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(239,225,197,0.97)';
  roundRect(ctx, 46, 190, 328, 380, 6); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#6a4930'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(161,52,40,0.5)'; ctx.lineWidth = 1;
  roundRect(ctx, 52, 196, 316, 368, 3); ctx.stroke();
  ctx.fillStyle = state.win ? 'rgba(174,50,39,0.14)' : 'rgba(49,43,35,0.13)';
  ctx.beginPath(); ctx.arc(210, 278, 66, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = state.win ? '#9f2f25' : '#393128';
  ctx.font = font(64);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(state.win ? '大捷' : '败北', 210, 278);
  ctx.font = font(18, false);
  ctx.fillText(state.win ? `${state.stage.name}告捷 · 歼敌 ${state.stats.kills}` : `阿斗被掳… 撑到第 ${state.wave} 波 · 歼敌 ${state.stats.kills}`, 210, 358);
  ctx.font = font(14, false);
  ctx.fillText(`${CONFIG.campaign.rank} · ${state.clearedStars}/${CONFIG.campaign.stages.length} 星`, 210, 398);
  drawStars(ctx, state.clearedStars, 432, 25);
  if (state.saveWarning) {
    ctx.fillStyle = '#8f3a2d'; ctx.font = font(11, false);
    ctx.fillText('存储受限 · 进度暂存于本次会话', 210, 470);
  }

  const hasNext = state.win && state.stageIndex < CONFIG.campaign.stages.length - 1;
  const complete = state.win && !hasNext;
  const label = hasNext ? '下一关' : complete ? '凯旋归营' : '重整再战';
  const sub = hasNext ? `${CONFIG.campaign.rank} · 第 ${state.stageIndex + 2} 关`
    : complete ? `${CONFIG.campaign.rank} · 五星` : `重试第 ${state.stageIndex + 1} 关`;
  drawButton(ctx, UI.restart, label, sub, { seal: true });
  ctx.restore();
}

export function render(ctx, state, drag) {
  if (state.title) { drawTitle(ctx, state); return; }
  drawBattleBackdrop(ctx);
  drawTopBar(ctx, state);
  drawBoard(ctx, state, drag);
  drawEnemies(ctx, state);
  drawEffects(ctx, state);
  drawBattleControls(ctx, state, drag, drawCard);
  // 铲子模式提示
  if (drag?.mode === 'brush') {
    ctx.fillStyle = '#6f3f85'; ctx.font = font(12);
    ctx.textAlign = 'center';
    ctx.fillText('点一个已部署普通单位改写成英雄字', 210, 600);
  } else if (drag?.mode === 'shovel' || drag?.item?.kind === 'shovel') {
    ctx.fillStyle = '#7d241b'; ctx.font = font(12);
    ctx.textAlign = 'center';
    ctx.fillText('把铲子拖到青色封地开垦', 210, 600);
  }
  drawBattleSignals(ctx, state);

  // 拖拽跟随
  if (drag?.item) {
    if (drag.item.kind === 'troop') drawCard(ctx, drag.x, drag.y, 46, { char: CONFIG.troops[drag.item.type].char, level: drag.item.level, style: 'troop' });
    else if (drag.item.kind === 'frag') drawCard(ctx, drag.x, drag.y, 46, { char: drag.item.char, level: drag.item.level ?? 1, style: 'frag' });
    else drawToolAtlasIcon(ctx, 1, drag.x - 24, drag.y - 24, 48, 48);
  }

  if (state.over) drawOverlay(ctx, state);
}
