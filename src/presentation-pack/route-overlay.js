import { font, presentationTokens, themeColors } from '../render-theme.js';
import { layoutForGamePack } from '../systems/ui-interaction/index.js';

function arrowHead(ctx, from, to, color, size = 6, alpha = 0.9) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const x = from.x + (to.x - from.x) * 0.62;
  const y = from.y + (to.y - from.y) * 0.62;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.67, -size * 0.63);
  ctx.lineTo(-size * 0.33, 0);
  ctx.lineTo(-size * 0.67, size * 0.63);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function marker(ctx, point, label, color, align, radius, paper, board, gamePack) {
  const offset = radius + 3;
  const x = point.x + (align === 'right' ? offset : -offset);
  const y = point.y + (point.y < board.oy + board.cellH ? offset : -offset);
  ctx.save();
  ctx.shadowColor = 'rgba(255,248,226,0.9)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = paper;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = font(Math.max(11, radius), true, gamePack);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
  ctx.restore();
}

// 路线只消费关卡展开后的 state.paths；renderer 不保存坐标副本。
export function drawRouteOverlay(ctx, state, gamePack) {
  const { board: B, cellXY } = layoutForGamePack(gamePack);
  const paths = Array.isArray(state.paths) && state.paths.length ? state.paths : [state.path];
  const colors = themeColors(gamePack);
  const route = presentationTokens(gamePack).route;
  const lineColor = colors.routeLine ?? '#8f3b30';
  const arrowColor = colors.routeArrow ?? '#722b24';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  paths.forEach((path, laneIndex) => {
    if (!Array.isArray(path) || path.length < 2) return;
    const points = path.map(({ r, c }) => cellXY(r, c));
    const laneAlpha = laneIndex % 2 === 0 ? route.primaryAlpha : route.secondaryAlpha;
    ctx.globalAlpha = laneAlpha * 0.48;
    ctx.strokeStyle = colors.paperRaised;
    ctx.lineWidth = route.underlayWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.stroke();
    ctx.globalAlpha = laneAlpha;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = route.lineWidth;
    ctx.setLineDash(route.dash);
    ctx.beginPath();
    points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.stroke();
    ctx.setLineDash([]);

    for (let index = 0; index < points.length - 1; index++) {
      const previous = points[Math.max(0, index - 1)];
      const current = points[index];
      const next = points[index + 1];
      const turned = index > 0 && Math.sign(current.x - previous.x) !== Math.sign(next.x - current.x)
        || index > 0 && Math.sign(current.y - previous.y) !== Math.sign(next.y - current.y);
      if (index % 3 === 1 || turned) {
        arrowHead(ctx, current, next, arrowColor, route.arrowSize, route.arrowAlpha);
      }
    }
    marker(ctx, points[0], '入', arrowColor, path[0].c > B.cols / 2 ? 'left' : 'right', route.markerRadius, colors.paperRaised, B, gamePack);
    marker(ctx, points.at(-1), '守', arrowColor, path.at(-1).c > B.cols / 2 ? 'left' : 'right', route.markerRadius, colors.paperRaised, B, gamePack);
  });
  ctx.restore();
}
