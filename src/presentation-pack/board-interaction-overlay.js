import { B } from '../ui-layout.js';
import { classifyUnitTransfer } from '../rulesets/merge-defense/unit-placement.js';
import { presentationTokens, themeColors } from '../render-theme.js';

function hovered(drag, r, c) {
  return drag.hover?.zone === 'grid' && drag.hover.r === r && drag.hover.c === c;
}

export function drawBoardInteractionOverlay(ctx, state, drag, gamePack) {
  if (!drag?.item && drag?.mode !== 'shovel' && drag?.mode !== 'brush') return;
  const colors = themeColors(gamePack);
  const { motion } = presentationTokens(gamePack);
  const pulse = 0.5 + 0.5 * Math.sin(state.time * Math.PI * 2 * motion.targetPulseHz);
  for (let r = 0; r < B.rows; r++) {
    for (let c = 0; c < B.cols; c++) {
      const cell = state.grid[r][c];
      const x = B.ox + c * B.cellW;
      const y = B.oy + r * B.cellH;
      if (drag.mode === 'brush') {
        const color = ['troop', 'frag'].includes(cell.unit?.kind)
          ? colors.qingPlayable
          : hovered(drag, r, c) ? (colors.invalidTarget ?? '#bd2d26') : null;
        if (color) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 3, y + 3, B.cellW - 6, B.cellH - 6);
        }
        continue;
      }
      if (drag.mode === 'shovel' || drag.item?.kind === 'shovel') {
        const color = cell.type === 'locked'
          ? colors.qingPlayable
          : hovered(drag, r, c) ? (colors.invalidTarget ?? '#bd2d26') : null;
        if (color) {
          ctx.strokeStyle = color;
          ctx.lineWidth = cell.type === 'locked' && !drag.item ? 2.5 : 3;
          ctx.strokeRect(x + 3, y + 3, B.cellW - 6, B.cellH - 6);
        }
        continue;
      }
      if (!drag.item) continue;
      const preview = classifyUnitTransfer(state, {
        source: drag.source,
        target: { zone: 'grid', r, c },
        expectedSource: drag.expectedSource,
      }, gamePack);
      if (preview.ok) {
        ctx.save();
        ctx.globalAlpha = preview.action === 'merge' ? 0.12 + pulse * 0.1 : 0.13 + pulse * 0.13;
        ctx.fillStyle = preview.action === 'merge' ? colors.mergeTarget : colors.qingPlayable;
        ctx.fillRect(x + 2, y + 2, B.cellW - 4, B.cellH - 4);
        ctx.restore();
        ctx.strokeStyle = preview.action === 'merge'
          ? (colors.mergeTarget ?? '#d39c16')
          : preview.action === 'swap'
            ? (colors.swapTarget ?? '#287eaa')
            : (colors.validTarget ?? '#3b8b55');
        ctx.lineWidth = hovered(drag, r, c) ? 4 : 2.5;
        ctx.strokeRect(x + 2, y + 2, B.cellW - 4, B.cellH - 4);
      } else if (hovered(drag, r, c)) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = colors.invalidTarget;
        ctx.fillRect(x + 2, y + 2, B.cellW - 4, B.cellH - 4);
        ctx.restore();
        ctx.strokeStyle = colors.invalidTarget ?? '#bd2d26';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(x + 2, y + 2, B.cellW - 4, B.cellH - 4);
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + B.cellW - 8, y + B.cellH - 8);
        ctx.moveTo(x + B.cellW - 8, y + 8); ctx.lineTo(x + 8, y + B.cellH - 8);
        ctx.stroke();
      }
    }
  }
}
