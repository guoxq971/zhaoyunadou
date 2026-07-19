// 渲染:纸底 / 棋盘 / 字牌 / 敌人 / 特效 / UI —— 全程序化,无图片素材
import { CONFIG } from './config.js';
import { enemyXY } from './enemies.js';
import { canMerge } from './logic.js';

const B = CONFIG.board;
export const cellXY = (r, c) => ({
  x: B.ox + (c + 0.5) * B.cell,
  y: B.oy + (r + 0.5) * B.cell,
});

// UI 热区(input.js 共用)
export const UI = {
  recruit: { x: 112, y: 640, w: 196, h: 58 },
  shovel:  { x: 22,  y: 640, w: 72,  h: 58 },
  speed:   { x: 326, y: 640, w: 72,  h: 58 },
  bench:   { x: 78,  y: 556, w: 48, h: 48, gap: 8 }, // 第 i 格 x = x + i*(w+gap)
  restart: { x: 130, y: 520, w: 160, h: 56 },
  start:   { x: 110, y: 560, w: 200, h: 64 },  // 标题页:开始游戏
  callWave:{ x: 60,  y: 60,  w: 300, h: 32 },  // 波间横幅:点击提前开战
};
export const benchRect = (i) => ({
  x: UI.bench.x + i * (UI.bench.w + UI.bench.gap), y: UI.bench.y,
  w: UI.bench.w, h: UI.bench.h,
});

const KAI = '"Kaiti SC","STKaiti",KaiTi,"KaiTi SC",serif';
const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px ${KAI}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- 背景纸纹(离屏缓存) ----------
let paperCache = null;
function paper(ctx) {
  if (!paperCache) {
    paperCache = document.createElement('canvas');
    paperCache.width = CONFIG.canvas.w; paperCache.height = CONFIG.canvas.h;
    const p = paperCache.getContext('2d');
    p.fillStyle = '#e6d9c3';
    p.fillRect(0, 0, paperCache.width, paperCache.height);
    for (let i = 0; i < 900; i++) { // 纸纤维噪点
      p.fillStyle = `rgba(120,100,70,${Math.random() * 0.06})`;
      p.fillRect(Math.random() * 420, Math.random() * 840, 1 + Math.random() * 2, 1);
    }
    for (let i = 0; i < 8; i++) {   // 大块淡墨晕
      p.fillStyle = `rgba(150,130,100,${0.04 + Math.random() * 0.04})`;
      p.beginPath();
      p.ellipse(Math.random() * 420, Math.random() * 840, 40 + Math.random() * 80, 30 + Math.random() * 50, Math.random() * 3, 0, 6.29);
      p.fill();
    }
  }
  ctx.drawImage(paperCache, 0, 0);
}

// ---------- 字牌 ----------
function drawCard(ctx, x, y, size, { char, level, style, shake = 0 }) {
  const s = size, half = s / 2;
  ctx.save();
  ctx.translate(x + (Math.random() * 2 - 1) * (shake > 0 ? 2 : 0), y);
  ctx.shadowColor = 'rgba(60,40,20,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  const bg = style === 'frag' ? '#f7ecd2' : style === 'hero' ? '#f5e3b0' : '#f6f1e4';
  ctx.fillStyle = bg;
  roundRect(ctx, -half, -half, s, s, 6);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = style === 'hero' ? 2.5 : 1.5;
  ctx.strokeStyle = style === 'frag' ? '#8757b0' : style === 'hero' ? '#c8951a' : '#b8ab90';
  ctx.stroke();
  ctx.fillStyle = style === 'hero' ? '#7a4a00' : '#241f18';
  ctx.font = font(s * 0.62);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 2);
  if (level) {
    ctx.fillStyle = '#a02020';
    ctx.font = font(s * 0.28);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(String(level), half - 3, -half + 2);
  }
  ctx.restore();
}

// ---------- 棋盘 ----------
function drawBoard(ctx, state, drag) {
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const cell = state.grid[r][c];
      const x = B.ox + c * B.cell, y = B.oy + r * B.cell;
      if (cell.type === 'path') {
        ctx.fillStyle = '#c8b198';
        ctx.fillRect(x, y, B.cell, B.cell);
        ctx.fillStyle = 'rgba(90,70,50,0.12)'; // 车辙点
        ctx.beginPath(); ctx.arc(x + 12, y + 24, 2, 0, 6.29); ctx.arc(x + 30, y + 14, 2, 0, 6.29); ctx.fill();
      } else if (cell.type === 'locked') {
        ctx.fillStyle = '#a9bfa8';
        ctx.fillRect(x + 1, y + 1, B.cell - 2, B.cell - 2);
        ctx.fillStyle = 'rgba(60,90,60,0.35)';
        ctx.font = font(13, false);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('苔', x + B.cell / 2, y + B.cell / 2);
      } else if (cell.type === 'open') {
        ctx.fillStyle = '#efe7d4';
        ctx.fillRect(x + 1, y + 1, B.cell - 2, B.cell - 2);
        ctx.strokeStyle = 'rgba(140,120,90,0.5)';
        ctx.strokeRect(x + 1.5, y + 1.5, B.cell - 3, B.cell - 3);
      } else if (cell.type === 'rock') {
        ctx.fillStyle = '#d6c9b2';
        ctx.fillRect(x, y, B.cell, B.cell);
        ctx.fillStyle = '#6e675c';
        ctx.beginPath();
        ctx.ellipse(x + B.cell / 2, y + B.cell / 2 + 4, 14, 10, 0, 0, 6.29);
        ctx.fill();
      } else if (cell.type === 'dou') {
        ctx.fillStyle = '#efe7d4';
        ctx.fillRect(x, y, B.cell, B.cell);
        drawCard(ctx, x + B.cell / 2, y + B.cell / 2, B.cell - 6, { char: '斗', style: 'troop' });
      }
    }
  }
  // 棋盘外框
  ctx.strokeStyle = '#3a3128'; ctx.lineWidth = 2.5;
  ctx.strokeRect(B.ox - 2, B.oy - 2, B.cols * B.cell + 4, B.rows * B.cell + 4);

  // 拖拽/铲子模式高亮
  if (drag?.item || drag?.mode === 'shovel') {
    const d = drag;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 6);
    for (let r = 0; r < B.rows; r++) {
      for (let c = 0; c < B.cols; c++) {
        const cell = state.grid[r][c];
        const x = B.ox + c * B.cell, y = B.oy + r * B.cell;
        if (d.mode === 'shovel') {
          if (cell.type === 'locked') {
            ctx.strokeStyle = `rgba(58,107,53,${0.4 + pulse * 0.5})`;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 3, y + 3, B.cell - 6, B.cell - 6);
          }
        } else if (d.item) {
          if (cell.type === 'open' && !cell.unit) {           // 可落格:绿
            ctx.fillStyle = `rgba(90,150,90,${0.15 + pulse * 0.15})`;
            ctx.fillRect(x + 2, y + 2, B.cell - 4, B.cell - 4);
          } else if (cell.unit && canMerge(cell.unit, d.item)) { // 可合成:金框
            ctx.strokeStyle = `rgba(200,149,26,${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 2, y + 2, B.cell - 4, B.cell - 4);
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
      if (u.kind === 'troop') drawCard(ctx, x, y, B.cell - 6, { char: CONFIG.troops[u.type].char, level: u.level, style: 'troop', shake: u.flash });
      else if (u.kind === 'frag') drawCard(ctx, x, y, B.cell - 6, { char: u.char, style: 'frag' });
    }
  }
  // 英雄(双格,盖在上层,带光晕)
  for (const h of state.heroes) {
    const cfg = CONFIG.heroes[h.key];
    const a = cellXY(h.r, h.c);
    ctx.save();
    ctx.shadowColor = 'rgba(220,170,40,0.9)'; ctx.shadowBlur = 12;
    drawCard(ctx, a.x, a.y, B.cell - 4, { char: cfg.chars[0], style: 'hero', shake: h.flash });
    drawCard(ctx, a.x + B.cell, a.y, B.cell - 4, { char: cfg.chars[1], style: 'hero', shake: h.flash });
    ctx.restore();
  }
}

// ---------- 敌人 ----------
function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    const t = CONFIG.enemy.types[e.type];
    const { x, y } = enemyXY(state, e, cellXY);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(e.bob) * 0.08);
    ctx.fillStyle = t.tint || '#2b2b2b';
    ctx.font = font(26 * t.size);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.char, 0, 0);
    ctx.restore();
    if (e.hp < e.maxHp) {
      const w = 26 * t.size;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - w / 2, y - 20 * t.size, w, 3);
      ctx.fillStyle = '#b03030';
      ctx.fillRect(x - w / 2, y - 20 * t.size, w * Math.max(e.hp / e.maxHp, 0), 3);
    }
    if (e.stun > 0) {
      ctx.fillStyle = '#b8860b'; ctx.font = font(12, false);
      ctx.textAlign = 'center';
      ctx.fillText('晕', x + 12, y - 16);
    }
  }
}

// ---------- 特效 ----------
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
      ctx.font = font(15 * f.scale);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
      const i = Math.min(Math.floor(f.p), state.path.length - 2);
      if (i >= 0) {
        const fr = Math.min(f.p - i, 1);
        const a = cellXY(state.path[i].r, state.path[i].c);
        const b = cellXY(state.path[i + 1].r, state.path[i + 1].c);
        const x = a.x + (b.x - a.x) * fr, y = a.y + (b.y - a.y) * fr;
        const g = ctx.createRadialGradient(x, y, 2, x, y, 26);
        g.addColorStop(0, 'rgba(255,200,80,0.95)');
        g.addColorStop(0.6, 'rgba(220,90,20,0.7)');
        g.addColorStop(1, 'rgba(180,40,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 26, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#7a1f00'; ctx.font = font(20);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('龙', x, y);
      }
    } else if (f.kind === 'rain') {
      ctx.strokeStyle = `rgba(50,40,30,${k * 0.7})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) {
        const x = (i * 137) % 396 + 12, y = ((i * 89) % 400) + 100 + f.t * 500;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); ctx.stroke();
      }
    }
  }
  // 弓箭弹道
  for (const p of state.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
    ctx.strokeStyle = '#3a2f22'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = '#3a2f22';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.fill();
    ctx.restore();
  }
}

// ---------- UI ----------
function drawButton(ctx, rc, label, sub, { active = true, seal = false } = {}) {
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  ctx.fillStyle = seal ? '#b23a2e' : '#efe6d0';
  ctx.shadowColor = 'rgba(60,40,20,0.3)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  roundRect(ctx, rc.x, rc.y, rc.w, rc.h, 10);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = seal ? '#7d241b' : '#a89778'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = seal ? '#fff6e8' : '#3a3128';
  ctx.font = font(sub ? rc.h * 0.4 : rc.h * 0.45);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, rc.x + rc.w / 2, rc.y + rc.h * (sub ? 0.32 : 0.5));
  if (sub) {
    ctx.font = font(rc.h * 0.26, false);
    ctx.fillText(sub, rc.x + rc.w / 2, rc.y + rc.h * 0.72);
  }
  ctx.restore();
}

function drawTopBar(ctx, state) {
  // 标题 + 波次
  ctx.fillStyle = '#2b241c';
  ctx.font = font(26);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('巨鹿', 210, 26);
  ctx.font = font(16, false);
  ctx.fillText(`第${Math.max(state.wave, 1)}波 / ${CONFIG.waves.count}`, 210, 50);
  // 命
  ctx.textAlign = 'left';
  ctx.font = '16px serif';
  let hearts = '';
  for (let i = 0; i < state.lives; i++) hearts += '❤';
  ctx.fillStyle = '#b03030';
  ctx.fillText(hearts || '☠', 14, 24);
  // 馒头
  ctx.fillStyle = '#f6f1e4';
  ctx.beginPath(); ctx.ellipse(26, 56, 13, 10, 0, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#b8ab90'; ctx.stroke();
  ctx.fillStyle = '#2b241c'; ctx.font = font(18);
  ctx.fillText(String(state.mantou), 46, 56);
  // 击杀数(右上)
  ctx.textAlign = 'right'; ctx.font = font(13, false);
  ctx.fillStyle = '#6b5d48';
  ctx.fillText(`歼敌 ${state.stats.kills}`, 406, 24);
}

function drawBench(ctx, state, drag) {
  // 营 图标
  ctx.fillStyle = '#7a4a2a';
  roundRect(ctx, 20, UI.bench.y + 2, 44, 44, 6); ctx.fill();
  ctx.fillStyle = '#f5ead2'; ctx.font = font(24);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('营', 42, UI.bench.y + 25);
  for (let i = 0; i < CONFIG.benchSize; i++) {
    const rc = benchRect(i);
    ctx.fillStyle = '#efe7d4';
    roundRect(ctx, rc.x, rc.y, rc.w, rc.h, 6); ctx.fill();
    ctx.strokeStyle = '#b0a184'; ctx.lineWidth = 1.5; ctx.stroke();
    const item = state.bench[i];
    if (item && !(drag && drag.from === 'bench' && drag.index === i)) {
      if (item.kind === 'troop') drawCard(ctx, rc.x + rc.w / 2, rc.y + rc.h / 2, rc.w - 4, { char: CONFIG.troops[item.type].char, level: item.level, style: 'troop' });
      else drawCard(ctx, rc.x + rc.w / 2, rc.y + rc.h / 2, rc.w - 4, { char: item.char, style: 'frag' });
    }
  }
}

function drawOverlay(ctx, state) {
  ctx.fillStyle = 'rgba(30,24,16,0.72)';
  ctx.fillRect(0, 0, 420, 840);
  ctx.fillStyle = '#f0e6d0';
  ctx.font = font(64);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(state.win ? '大捷' : '败北', 210, 330);
  ctx.font = font(18, false);
  ctx.fillText(state.win ? `守住阿斗!歼敌 ${state.stats.kills}` : `阿斗被掳… 撑到第 ${state.wave} 波,歼敌 ${state.stats.kills}`, 210, 400);
  const best = Number(localStorage.getItem('zyad_best') || 0);
  ctx.font = font(14, false);
  ctx.fillText(`最佳纪录:第 ${best} 波`, 210, 440);
  drawButton(ctx, UI.restart, '再来一局', null, { seal: true });
}

// 标题页
function drawTitle(ctx, state) {
  paper(ctx);
  ctx.fillStyle = '#2b241c';
  ctx.font = font(58);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('赵云与阿斗', 210, 240);
  ctx.font = font(20, false);
  ctx.fillStyle = '#6b5d48';
  ctx.fillText('汉字塔防 · 巨鹿之战', 210, 300);
  // 印章点缀
  ctx.save();
  ctx.translate(320, 350); ctx.rotate(0.12);
  ctx.fillStyle = '#b23a2e';
  ctx.fillRect(-26, -26, 52, 52);
  ctx.fillStyle = '#fff6e8'; ctx.font = font(20);
  ctx.fillText('复刻', 0, 0);
  ctx.restore();
  const best = Number(localStorage.getItem('zyad_best') || 0);
  ctx.fillStyle = '#6b5d48'; ctx.font = font(15, false);
  ctx.textAlign = 'center';
  ctx.fillText(best > 0 ? `最佳纪录:第 ${best} 波` : '守护阿斗,撑过 20 波', 210, 480);
  drawButton(ctx, UI.start, '开始游戏', null, { seal: true });
  ctx.fillStyle = 'rgba(90,75,55,0.6)'; ctx.font = font(12, false);
  ctx.fillText('征兵抽卡 · 同字合成 · 拼出五虎上将', 210, 680);
}

export function render(ctx, state, drag) {
  if (state.title) { drawTitle(ctx, state); return; }
  paper(ctx);
  drawTopBar(ctx, state);
  drawBoard(ctx, state, drag);
  drawEnemies(ctx, state);
  drawEffects(ctx, state);
  drawBench(ctx, state, drag);

  const cost = CONFIG.recruitCost(state.recruitCount);
  const benchFree = state.bench.some((b) => b === null);
  const sub = !benchFree ? '营已满' : `馒头 ${cost}`;
  drawButton(ctx, UI.recruit, '征兵', sub, { active: state.mantou >= cost && benchFree, seal: true });
  drawButton(ctx, UI.shovel, `铲×${state.shovels}`, null, { active: state.shovels > 0, seal: drag?.mode === 'shovel' });
  drawButton(ctx, UI.speed, `×${state.speed}`, null, {});

  // 波间提示(可点击提前开战)
  if (state.phase === 'break' && !state.over) {
    ctx.fillStyle = 'rgba(43,36,28,0.85)';
    ctx.font = font(22);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`第 ${state.wave + 1} 波来袭… ${Math.ceil(state.phaseT)}`, 210, 72);
    ctx.font = font(13, false);
    ctx.fillStyle = '#8a6d3b';
    ctx.fillText('▶ 点此提前开战', 210, 90);
  }

  // 危:敌人逼近阿斗警示
  const endNear = state.enemies.some((e) => e.p > state.path.length * 0.78);
  if (endNear) {
    const a = Math.abs(Math.sin(state.time * 5));
    ctx.fillStyle = `rgba(160,32,32,${0.5 + a * 0.5})`;
    ctx.font = font(30);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('危', B.ox + 7.5 * B.cell, B.oy + 9.5 * B.cell);
  }
  // 铲子模式提示
  if (drag?.mode === 'shovel') {
    ctx.fillStyle = '#7d241b'; ctx.font = font(15);
    ctx.textAlign = 'center';
    ctx.fillText('点一块「苔」地开垦(再点铲子取消)', 210, 720);
  } else {
    ctx.fillStyle = 'rgba(90,75,55,0.75)'; ctx.font = font(13, false);
    ctx.textAlign = 'center';
    ctx.fillText('拖字牌上阵 · 同字同级叠放合成 · 英雄名左右相邻拼出', 210, 720);
  }

  // 拖拽跟随
  if (drag?.item) {
    if (drag.item.kind === 'troop') drawCard(ctx, drag.x, drag.y, 46, { char: CONFIG.troops[drag.item.type].char, level: drag.item.level, style: 'troop' });
    else drawCard(ctx, drag.x, drag.y, 46, { char: drag.item.char, style: 'frag' });
  }

  if (state.over) drawOverlay(ctx, state);
}
