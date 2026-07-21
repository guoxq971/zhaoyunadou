import { presentationTokens, themeColors } from '../render-theme.js';
import { layoutForGamePack } from '../systems/ui-interaction/index.js';
import { traceProjectedCell } from './cloud-arena-board.js';

function hovered(drag, r, c) {
  return drag.hover?.zone === 'grid' && drag.hover.r === r && drag.hover.c === c;
}

export function drawBoardInteractionOverlay(ctx, state, drag, gamePack) {
  if (!drag?.item && drag?.mode !== 'shovel' && drag?.mode !== 'brush') return;
  const layout = layoutForGamePack(gamePack);
  const B = layout.board;
  const projected = layout.projection.mode === 'shallow-perspective';
  const colors = themeColors(gamePack);
  const { motion } = presentationTokens(gamePack);
  const pulse = 0.5 + 0.5 * Math.sin(state.time * Math.PI * 2 * motion.targetPulseHz);
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const preview = state.interactionTargets?.grid?.[r]?.[c] ?? null;
      const x = B.ox + c * B.cellW;
      const y = B.oy + r * B.cellH;
      const strokeTarget = (amount = 3) => {
        if (projected) {
          traceProjectedCell(ctx, layout, r, c, amount);
          ctx.stroke();
        } else ctx.strokeRect(x + amount, y + amount, B.cellW - amount * 2, B.cellH - amount * 2);
      };
      const fillTarget = (amount = 2) => {
        if (projected) {
          traceProjectedCell(ctx, layout, r, c, amount);
          ctx.fill();
        } else ctx.fillRect(x + amount, y + amount, B.cellW - amount * 2, B.cellH - amount * 2);
      };
      if (drag.mode === 'brush') {
        const color = preview?.ok
          ? colors.qingPlayable
          : hovered(drag, r, c) ? (colors.invalidTarget ?? '#bd2d26') : null;
        if (color) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          strokeTarget(3);
        }
        continue;
      }
      if (drag.mode === 'shovel' || drag.item?.kind === 'shovel') {
        const color = preview?.ok
          ? colors.qingPlayable
          : hovered(drag, r, c) ? (colors.invalidTarget ?? '#bd2d26') : null;
        if (color) {
          ctx.strokeStyle = color;
          ctx.lineWidth = preview?.ok && !drag.item ? 2.5 : 3;
          strokeTarget(3);
        }
        continue;
      }
      if (!drag.item) continue;
      if (preview?.ok) {
        ctx.save();
        ctx.globalAlpha = preview.action === 'merge' ? 0.12 + pulse * 0.1 : 0.13 + pulse * 0.13;
        ctx.fillStyle = preview.action === 'merge' ? colors.mergeTarget : colors.qingPlayable;
        fillTarget(2);
        ctx.restore();
        ctx.strokeStyle = preview.action === 'merge'
          ? (colors.mergeTarget ?? '#d39c16')
          : preview.action === 'swap'
            ? (colors.swapTarget ?? '#287eaa')
            : (colors.validTarget ?? '#3b8b55');
        ctx.lineWidth = hovered(drag, r, c) ? 4 : 2.5;
        strokeTarget(2);
      } else if (hovered(drag, r, c)) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = colors.invalidTarget;
        fillTarget(2);
        ctx.restore();
        ctx.strokeStyle = colors.invalidTarget ?? '#bd2d26';
        ctx.lineWidth = 3.5;
        strokeTarget(2);
        const polygon = projected ? layout.cellPolygon(r, c) : [
          { x, y }, { x: x + B.cellW, y },
          { x: x + B.cellW, y: y + B.cellH }, { x, y: y + B.cellH },
        ];
        ctx.beginPath();
        ctx.moveTo(polygon[0].x + 7, polygon[0].y + 7);
        ctx.lineTo(polygon[2].x - 7, polygon[2].y - 7);
        ctx.moveTo(polygon[1].x - 7, polygon[1].y + 7);
        ctx.lineTo(polygon[3].x + 7, polygon[3].y - 7);
        ctx.stroke();
      }
    }
  }
}
