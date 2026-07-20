// 参考图式底部操作区：营栏与主按钮保持可操作，黑框军械栏只表达系统状态。
import { drawToolAtlasIcon, font, presentationTokens, roundRect, themeColors } from './render-theme.js';
import { copyText } from './engine-core/public.js';
import { layoutForGamePack } from './systems/ui-interaction/index.js';
import { resolveLegacyPresentationGamePack } from './systems/skin-presentation/legacy-game-pack.js';

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

function drawCamp(ctx, state, drag, drawCard, gamePack, host) {
  const { ui: UI, benchRect } = layoutForGamePack(gamePack);
  const config = gamePack.config;
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  const y = UI.bench.y;
  ctx.save();

  // 营字小屋檐略高于纸槽，保留参考图中“贴着棋盘”的紧凑感。
  ctx.shadowColor = 'rgba(42,28,18,0.2)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = colors.inkStructure;
  strokePath(ctx, [[22, y + 7], [48, y - 10], [74, y + 7]], { close: true, width: tokens.strokes.default, color: colors.inkStrong });
  ctx.fill();
  ctx.fillStyle = colors.inkStructure;
  roundRect(ctx, 27, y + 5, 42, 43, 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = colors.inkStrong;
  ctx.lineWidth = tokens.strokes.default;
  ctx.stroke();
  ctx.fillStyle = colors.paperRaised;
  ctx.font = font(25, true, gamePack);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, 'battle.camp'), 48, y + 27);

  for (let i = 0; i < config.benchSize; i++) {
    const rect = benchRect(i);
    ctx.fillStyle = colors.paperRaised;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 2);
    ctx.fill();
    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = tokens.strokes.default;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(102,84,61,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(rect.x + 4, rect.y + 5);
    ctx.lineTo(rect.x + rect.w - 5, rect.y + 4);
    ctx.stroke();

    const item = state.bench?.[i];
    const isDragged = drag?.item && drag.from === 'bench' && drag.index === i;
    if (item && !isDragged) {
      if (item.kind === 'troop') {
        drawCard(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 4, {
          char: config.troops[item.type]?.char ?? '?',
          level: item.level,
          style: 'troop',
        });
      } else if (item.kind === 'frag') {
        drawCard(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 4, {
          char: item.char,
          level: item.level ?? 1,
          style: 'frag',
        });
      } else if (!drawToolAtlasIcon(ctx, 'item.shovel', rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, gamePack, host)) {
        ctx.fillStyle = '#9b711e';
        ctx.font = font(25, true, gamePack);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('铲', rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
    }

    if (isDragged) {
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = colors.swapTarget ?? '#287eaa';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
      ctx.setLineDash([]);
    } else if (drag?.item?.kind === 'troop' || drag?.item?.kind === 'frag') {
      const preview = state.interactionTargets?.bench?.[i];
      const hovered = drag.hover?.zone === 'bench' && drag.hover.index === i;
      const color = preview?.ok
        ? preview.action === 'swap' ? (colors.swapTarget ?? '#287eaa') : (colors.validTarget ?? '#3b8b55')
        : hovered ? (colors.invalidTarget ?? '#bd2d26') : null;
      if (color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = hovered ? 3.5 : 2;
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      }
    } else if (drag?.item?.kind === 'shovel') {
      const hovered = drag.hover?.zone === 'bench' && drag.hover.index === i;
      if (!item || hovered) {
        ctx.strokeStyle = !item ? (colors.validTarget ?? '#3b8b55') : (colors.invalidTarget ?? '#bd2d26');
        ctx.lineWidth = hovered ? 3.5 : 2;
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      }
    }
  }
  ctx.restore();
}

function drawRoundBase(ctx, rect, gamePack, { active = true, selected = false } = {}) {
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.min(rect.w, rect.h) / 2 - 2;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.shadowColor = active ? 'rgba(35,24,16,0.22)' : 'rgba(35,24,16,0.1)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = active ? selected ? colors.qingPlayableWash : colors.paperRaised : colors.disabledSurface;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = selected ? colors.qingPlayable : active ? colors.inkStructure : colors.disabledInk;
  ctx.lineWidth = selected ? tokens.strokes.strong : tokens.strokes.default;
  ctx.stroke();
  ctx.strokeStyle = selected ? colors.paperRaised : colors.cellLine;
  ctx.lineWidth = tokens.strokes.hairline;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBrush(ctx, rect, state, drag, gamePack, host) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const enabled = state.brushes > 0;
  drawRoundBase(ctx, rect, gamePack, { active: enabled, selected: drag?.mode === 'brush' });
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.45;
  if (!drawToolAtlasIcon(ctx, 'item.brush', cx - 24, cy - 28, 48, 48, gamePack, host)) {
    ctx.fillStyle = '#35281d';
    ctx.font = font(28, true, gamePack);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('笔', cx, cy - 2);
  }
  ctx.restore();
  ctx.fillStyle = enabled ? '#35281d' : '#756a59';
  ctx.font = font(11, true, gamePack);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`×${state.brushes ?? 0}`, cx + 15, cy + 18);
}

function drawRecruit(ctx, state, drag, gamePack, host) {
  const { ui: UI } = layoutForGamePack(gamePack);
  const config = gamePack.config;
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  const rect = UI.recruit;
  const preview = state.recruitPreview ?? { free: 0, count: 0, cost: 0 };
  const enabled = preview.count > 0;
  ctx.save();
  ctx.shadowColor = enabled ? 'rgba(45,26,16,0.34)' : 'rgba(45,26,16,0.08)';
  ctx.shadowBlur = enabled ? tokens.shadows.buttonBlur : 2;
  ctx.shadowOffsetY = enabled ? 3 : 1;
  ctx.fillStyle = enabled ? colors.cinnabarAction : colors.disabledSurface;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = enabled ? colors.inkStructure : colors.disabledInk;
  ctx.lineWidth = tokens.strokes.strong;
  ctx.stroke();
  ctx.strokeStyle = enabled ? colors.paperLight : colors.inkMuted;
  ctx.lineWidth = tokens.strokes.hairline;
  roundRect(ctx, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 2);
  ctx.stroke();
  ctx.fillStyle = enabled ? colors.paperRaised : colors.disabledInk;
  ctx.font = font(28, true, gamePack);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, 'battle.recruit.batch', {}, '征满'), rect.x + rect.w / 2, rect.y + 23);
  ctx.fillStyle = enabled ? colors.paperLight : colors.disabledInk;
  ctx.font = font(13, true, gamePack);
  const latest = drag?.lastRecruitBatch?.until > state.time ? drag.lastRecruitBatch : null;
  const summary = latest
    ? copyText(gamePack, 'battle.recruit.batchResult', {
      count: latest.filledCount, cost: latest.totalCost,
    }, `征得 ${latest.filledCount} · 耗 ${latest.totalCost}`)
    : preview.count > 0
      ? copyText(gamePack, 'battle.recruit.batchPreview', {
        count: preview.count, cost: preview.cost,
      }, `可征 ${preview.count} · 耗 ${preview.cost}`)
      : preview.free === 0 ? copyText(gamePack, 'battle.benchFull') : '馒头不足';
  ctx.fillText(summary, rect.x + rect.w / 2, rect.y + 48);
  ctx.restore();
}

function drawSpeedBag(ctx, rect, state, gamePack, host) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  drawRoundBase(ctx, rect, gamePack, { selected: state.speed === 2 });
  ctx.save();
  drawToolAtlasIcon(ctx, 'item.explosives', cx - 24, cy - 28, 48, 48, gamePack, host);
  ctx.fillStyle = '#f6ead2';
  ctx.strokeStyle = '#2b241d';
  ctx.lineWidth = 3;
  ctx.font = font(11, true, gamePack);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const speedText = state.speed === 0 ? '▶' : `×${state.speed}`;
  ctx.strokeText(speedText, cx + 14, cy + 18);
  ctx.fillText(speedText, cx + 14, cy + 18);
  ctx.restore();
}

const PASSIVE_TOOLS = [
  { icon: 'item.shovel', key: 'luoyang' },
  { icon: 'item.treasure', key: 'treasure' },
  { icon: 'item.talisman', key: 'talisman' },
  { icon: 'item.recruit-scroll', key: 'recruit-scroll' },
  { icon: 'item.meteor', key: 'meteor' },
];

function drawToolStatus(ctx, state, gamePack, host) {
  const { toolRect } = layoutForGamePack(gamePack);
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  ctx.save();
  const remaining = Math.max(0, Math.ceil((state.luoyang?.interval ?? 60) - (state.luoyang?.elapsed ?? 0)));
  for (let i = 0; i < 5; i++) {
    const rect = toolRect(i);
    const tool = PASSIVE_TOOLS[i];
    const equipped = tool.key === 'luoyang' && state.luoyang?.enabled;
    ctx.shadowColor = equipped ? 'rgba(34,23,15,0.22)' : 'transparent';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = equipped ? colors.qingPlayableWash : 'rgba(255,253,246,0.32)';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = equipped ? colors.qingPlayable : colors.inkMuted;
    ctx.lineWidth = equipped ? tokens.strokes.strong : tokens.strokes.hairline;
    ctx.stroke();
    ctx.fillStyle = equipped ? 'rgba(255,253,246,0.48)' : 'rgba(255,253,246,0.16)';
    ctx.fillRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
    ctx.save();
    ctx.globalAlpha = equipped ? 1 : 0.28;
    drawToolAtlasIcon(ctx, tool.icon, rect.x + 6, rect.y + 4, rect.w - 12, rect.h - 9, gamePack, host);
    ctx.restore();
    if (!equipped) continue;
    ctx.fillStyle = 'rgba(51,39,24,0.9)';
    roundRect(ctx, rect.x + rect.w - 22, rect.y + 3, 19, 15, 6);
    ctx.fill();
    ctx.fillStyle = '#fff0ba';
    ctx.font = font(8, false, gamePack);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.luoyang.pending ? copyText(gamePack, 'battle.tool.pending') : String(remaining), rect.x + rect.w - 12.5, rect.y + 10.5);
  }
  ctx.restore();
}

export function drawBattleControls(
  ctx,
  state,
  drag,
  drawCard,
  gamePack = null,
  host = null,
) {
  gamePack = resolveLegacyPresentationGamePack(state, gamePack);
  const { ui: UI } = layoutForGamePack(gamePack);
  drawCamp(ctx, state, drag, drawCard, gamePack, host);
  drawBrush(ctx, UI.shovel, state, drag, gamePack, host);
  drawRecruit(ctx, state, drag, gamePack, host);
  drawSpeedBag(ctx, UI.speed, state, gamePack, host);
  drawToolStatus(ctx, state, gamePack, host);
}
