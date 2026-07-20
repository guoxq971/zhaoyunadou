// 参考图式底部操作区：营栏与主按钮保持可操作，黑框军械栏只表达系统状态。
import { CONFIG } from './config.js';
import { UI, benchRect, toolRect } from './ui-layout.js';
import { drawToolAtlasIcon, font, roundRect } from './render-theme.js';

function strokePath(ctx, points, { close = false, width = 3, color = '#211b16' } = {}) {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawCamp(ctx, state, drag, drawCard) {
  const y = UI.bench.y;
  ctx.save();

  // 营字小屋檐略高于纸槽，保留参考图中“贴着棋盘”的紧凑感。
  ctx.shadowColor = 'rgba(42,28,18,0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#77351f';
  strokePath(ctx, [[22, y + 7], [48, y - 10], [74, y + 7]], { close: true, width: 3 });
  ctx.fill();
  ctx.fillStyle = '#4e2519';
  roundRect(ctx, 27, y + 5, 42, 43, 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#211813';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#f5e4c2';
  ctx.font = font(25);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('营', 48, y + 27);

  for (let i = 0; i < CONFIG.benchSize; i++) {
    const rect = benchRect(i);
    const paper = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    paper.addColorStop(0, '#fffdf5');
    paper.addColorStop(1, '#ddd2bd');
    ctx.fillStyle = paper;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 2);
    ctx.fill();
    ctx.strokeStyle = '#766c5b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(102,84,61,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(rect.x + 4, rect.y + 5);
    ctx.lineTo(rect.x + rect.w - 5, rect.y + 4);
    ctx.stroke();

    const item = state.bench?.[i];
    const isDragged = drag?.item && drag.from === 'bench' && drag.index === i;
    if (!item || isDragged) continue;
    if (item.kind === 'troop') {
      drawCard(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 4, {
        char: CONFIG.troops[item.type]?.char ?? '?',
        level: item.level,
        style: 'troop',
      });
    } else if (item.kind === 'frag') {
      drawCard(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 4, {
        char: item.char,
        level: item.level ?? 1,
        style: 'frag',
      });
    } else if (!drawToolAtlasIcon(ctx, 1, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10)) {
      ctx.fillStyle = '#9b711e';
      ctx.font = font(25);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('铲', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
  }
  ctx.restore();
}

function drawRoundBase(ctx, rect, { active = true, selected = false } = {}) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.min(rect.w, rect.h) / 2 - 2;
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.48;
  ctx.shadowColor = 'rgba(35,24,16,0.35)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = selected ? '#e8b43c' : '#e8deca';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = selected ? '#8b2c1e' : '#181613';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = selected ? '#fff0a8' : 'rgba(117,93,61,0.58)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBrush(ctx, rect, state, drag) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const enabled = state.brushes > 0;
  drawRoundBase(ctx, rect, { active: enabled, selected: drag?.mode === 'brush' });
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.45;
  if (!drawToolAtlasIcon(ctx, 3, cx - 24, cy - 28, 48, 48)) {
    ctx.fillStyle = '#35281d';
    ctx.font = font(28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('笔', cx, cy - 2);
  }
  ctx.restore();
  ctx.fillStyle = enabled ? '#35281d' : '#756a59';
  ctx.font = font(11);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`×${state.brushes ?? 0}`, cx + 15, cy + 18);
}

function drawRecruit(ctx, state) {
  const rect = UI.recruit;
  const cost = CONFIG.recruitCost(state.recruitCount);
  const benchFree = state.bench?.some((item) => item === null);
  const enabled = state.mantou >= cost && benchFree;
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.52;
  ctx.shadowColor = 'rgba(45,26,16,0.42)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#c96d48';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#2c1d16';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,211,174,0.62)';
  ctx.lineWidth = 1;
  roundRect(ctx, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 2);
  ctx.stroke();
  ctx.fillStyle = '#231b17';
  ctx.font = font(28);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('征兵', rect.x + rect.w / 2, rect.y + 24);
  if (!drawToolAtlasIcon(ctx, 0, rect.x + 39, rect.y + 36, 25, 25)) {
    ctx.fillStyle = '#f4ecda';
    ctx.beginPath();
    ctx.ellipse(rect.x + 52, rect.y + 48, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#34271e';
  ctx.font = font(15);
  ctx.fillText(benchFree ? String(cost) : '营满', rect.x + 80, rect.y + 48);
  ctx.restore();
}

function drawSpeedBag(ctx, rect, state) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  drawRoundBase(ctx, rect, { selected: state.speed === 2 });
  ctx.save();
  drawToolAtlasIcon(ctx, 10, cx - 24, cy - 28, 48, 48);
  ctx.fillStyle = '#f6ead2';
  ctx.strokeStyle = '#2b241d';
  ctx.lineWidth = 3;
  ctx.font = font(11);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const speedText = state.speed === 0 ? '▶' : `×${state.speed}`;
  ctx.strokeText(speedText, cx + 14, cy + 18);
  ctx.fillText(speedText, cx + 14, cy + 18);
  ctx.restore();
}

const PASSIVE_TOOLS = [
  { icon: 1, key: 'luoyang' },
  { icon: 2, key: 'treasure' },
  { icon: 11, key: 'talisman' },
  { icon: 4, key: 'recruit-scroll' },
  { icon: 5, key: 'meteor' },
];

function drawToolStatus(ctx, state) {
  ctx.save();
  const remaining = Math.max(0, Math.ceil((state.luoyang?.interval ?? 60) - (state.luoyang?.elapsed ?? 0)));
  for (let i = 0; i < 5; i++) {
    const rect = toolRect(i);
    const tool = PASSIVE_TOOLS[i];
    const equipped = tool.key === 'luoyang' && state.luoyang?.enabled;
    ctx.shadowColor = 'rgba(34,23,15,0.34)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = equipped ? '#d9ad3d' : '#59564d';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = equipped ? '#9c6618' : '#171512';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = equipped ? '#ead69d' : '#77766d';
    ctx.fillRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
    ctx.save();
    ctx.globalAlpha = equipped ? 1 : 0.52;
    drawToolAtlasIcon(ctx, tool.icon, rect.x + 6, rect.y + 4, rect.w - 12, rect.h - 9);
    ctx.restore();
    if (!equipped) continue;
    ctx.fillStyle = 'rgba(51,39,24,0.9)';
    roundRect(ctx, rect.x + rect.w - 22, rect.y + 3, 19, 15, 6);
    ctx.fill();
    ctx.fillStyle = '#fff0ba';
    ctx.font = font(8, false);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.luoyang.pending ? '待发' : String(remaining), rect.x + rect.w - 12.5, rect.y + 10.5);
  }
  ctx.restore();
}

export function drawBattleControls(ctx, state, drag, drawCard) {
  drawCamp(ctx, state, drag, drawCard);
  drawBrush(ctx, UI.shovel, state, drag);
  drawRecruit(ctx, state);
  drawSpeedBag(ctx, UI.speed, state);
  drawToolStatus(ctx, state);
}
