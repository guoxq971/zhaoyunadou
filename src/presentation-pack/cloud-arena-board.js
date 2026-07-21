import { copyText } from '../engine-core/public.js';
import { font } from '../render-theme.js';

function polygonPath(ctx, points) {
  ctx.beginPath();
  points.forEach((point, index) => (
    index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)
  ));
  ctx.closePath();
}

function shifted(points, dy) {
  return points.map(({ x, y }) => ({ x, y: y + dy }));
}

function inset(points, amount) {
  const center = points.reduce((sum, point) => ({
    x: sum.x + point.x / points.length,
    y: sum.y + point.y / points.length,
  }), { x: 0, y: 0 });
  return points.map((point) => {
    const distance = Math.hypot(point.x - center.x, point.y - center.y) || 1;
    return {
      x: point.x + (center.x - point.x) * amount / distance,
      y: point.y + (center.y - point.y) * amount / distance,
    };
  });
}

function face(ctx, points, fill) {
  polygonPath(ctx, points);
  ctx.fillStyle = fill;
  ctx.fill();
}

function pointBetween(start, end, ratio) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function cellColor(cell, colors) {
  if (cell.type === 'open') return colors.openCell;
  if (cell.type === 'locked') return colors.lockedCell;
  if (cell.type === 'path' || cell.type === 'spawn') return colors.pathCell;
  if (cell.type === 'gate') return '#c99e7c';
  return '#8c958d';
}

function drawStoneCrack(ctx, points, row, column, colors) {
  const center = points.reduce((sum, point) => ({
    x: sum.x + point.x / points.length,
    y: sum.y + point.y / points.length,
  }), { x: 0, y: 0 });
  const direction = ((row * 5 + column * 3) % 7) - 3;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = colors.inkStructure;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(center.x - 7, center.y + direction);
  ctx.lineTo(center.x - 1, center.y - 2);
  ctx.lineTo(center.x + 4, center.y + 1);
  ctx.lineTo(center.x + 8, center.y - 4);
  ctx.stroke();
  ctx.restore();
}

// 颗粒位置只由格坐标决定，不消费玩法或表现随机数，保证截图与回放稳定。
function drawStonePatina(ctx, points, row, column, colors, style, cellType) {
  const center = points.reduce((sum, point) => ({
    x: sum.x + point.x / points.length,
    y: sum.y + point.y / points.length,
  }), { x: 0, y: 0 });
  const grainAlpha = style.stoneGrainAlpha ?? 0.12;
  const variationAlpha = style.stoneVariationAlpha ?? 0.06;
  const isPath = cellType === 'path' || cellType === 'spawn';
  ctx.save();
  // 相邻石板使用极轻的冷暖差，避免大面积同明度色块形成电子表格感。
  ctx.globalAlpha = variationAlpha * (isPath ? 1.2 : 1);
  face(
    ctx,
    inset(points, 1.2),
    (row * 7 + column * 11) % 3 === 0 ? colors.paperLight : colors.inkStructure,
  );
  ctx.globalAlpha = grainAlpha;
  ctx.fillStyle = isPath ? '#785545' : colors.inkStructure;
  for (let index = 0; index < 3; index++) {
    const seed = row * 37 + column * 19 + index * 11;
    const x = center.x - 13 + (seed % 27);
    const y = center.y - 10 + ((seed * 7) % 19);
    ctx.beginPath();
    ctx.arc(x, y, 0.55 + (seed % 3) * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  // 一条不规则的浅色磨痕打破规则色块，但不进入弈子文字所在的中央区域。
  ctx.globalAlpha = grainAlpha * 0.72;
  ctx.strokeStyle = colors.paperLight;
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(points[0].x + 6 + ((row + column) % 4), points[0].y + 6);
  ctx.quadraticCurveTo(
    center.x - 5,
    center.y - 10 + ((row * 3 + column) % 5),
    points[1].x - 8,
    points[1].y + 7,
  );
  ctx.stroke();
  const chipCorner = (row * 5 + column * 3) % points.length;
  const corner = points[chipCorner];
  const next = points[(chipCorner + 1) % points.length];
  const previous = points[(chipCorner + points.length - 1) % points.length];
  ctx.globalAlpha = grainAlpha * 0.9;
  ctx.fillStyle = colors.paperLight;
  ctx.beginPath();
  ctx.moveTo(corner.x, corner.y);
  ctx.lineTo(corner.x + (next.x - corner.x) * 0.12, corner.y + (next.y - corner.y) * 0.12);
  ctx.lineTo(corner.x + (previous.x - corner.x) * 0.1, corner.y + (previous.y - corner.y) * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function platformPolygon(layout, padding = 9) {
  const { board: B, boardWidth, boardHeight, projectPoint } = layout;
  return [
    projectPoint(B.ox - padding, B.oy - padding),
    projectPoint(B.ox + boardWidth + padding, B.oy - padding),
    projectPoint(B.ox + boardWidth + padding, B.oy + boardHeight + padding),
    projectPoint(B.ox - padding, B.oy + boardHeight + padding),
  ];
}

// 整块演武台先建立落影、右侧墙和前墙，再画格面。
export function drawCloudArenaPlatform(ctx, layout, colors, style) {
  const top = platformPolygon(layout);
  const depth = style.platformDepth ?? 18;
  const bottom = shifted(top, depth);
  ctx.save();
  ctx.shadowColor = 'rgba(25,25,21,0.48)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 9;
  face(ctx, shifted(top, depth + 5), 'rgba(22,27,25,0.58)');
  ctx.shadowColor = 'transparent';
  face(ctx, [top[1], top[2], bottom[2], bottom[1]], '#5b5f55');
  face(ctx, [top[3], top[2], bottom[2], bottom[3]], '#474d46');
  const stone = ctx.createLinearGradient(0, top[0].y, 0, top[3].y);
  stone.addColorStop(0, '#a8a28d');
  stone.addColorStop(0.24, '#858777');
  stone.addColorStop(1, '#626a62');
  face(ctx, top, stone);
  ctx.strokeStyle = 'rgba(48,48,40,0.72)';
  ctx.lineWidth = 1.6;
  polygonPath(ctx, top);
  ctx.stroke();
  ctx.restore();
}

export function drawCloudArenaCell(ctx, cell, row, column, layout, colors, style, gamePack) {
  const depth = style.tileDepth ?? 6;
  const points = inset(layout.cellPolygon(row, column), style.tileInset ?? 0.8);
  const lowered = shifted(points, depth);
  ctx.save();
  face(ctx, [points[1], points[2], lowered[2], lowered[1]], 'rgba(56,64,59,0.72)');
  face(ctx, [points[3], points[2], lowered[2], lowered[3]], 'rgba(42,49,45,0.7)');
  const topColor = cellColor(cell, colors);
  const tile = ctx.createLinearGradient(0, points[0].y, 0, points[3].y);
  tile.addColorStop(0, colors.paperRaised);
  tile.addColorStop(0.12, topColor);
  tile.addColorStop(1, topColor);
  if (cell.type === 'path' || cell.type === 'spawn') {
    ctx.globalAlpha = style.routeSurfaceAlpha ?? 0.86;
  }
  face(ctx, points, tile);
  ctx.globalAlpha = 1;
  // 相邻格顶面会遮住外挤的侧面；在格面内留一条暗色石板倒角，确保每格都有可见厚度。
  const bevel = Math.min(3.5, depth * 0.62);
  face(ctx, [
    { x: points[3].x, y: points[3].y - bevel },
    { x: points[2].x, y: points[2].y - bevel },
    points[2], points[3],
  ], 'rgba(42,50,46,0.22)');
  face(ctx, [
    { x: points[1].x - bevel, y: points[1].y + 1 }, points[1], points[2],
    { x: points[2].x - bevel, y: points[2].y - 1 },
  ], 'rgba(35,43,40,0.16)');
  ctx.globalAlpha = style.highlightAlpha ?? 0.58;
  ctx.strokeStyle = colors.paperLight;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(points[0].x + 3, points[0].y + 2);
  ctx.lineTo(points[1].x - 3, points[1].y + 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.cellLine;
  ctx.lineWidth = 0.65;
  polygonPath(ctx, points);
  ctx.stroke();
  drawStonePatina(ctx, points, row, column, colors, style, cell.type);
  drawStoneCrack(ctx, points, row, column, colors);
  const center = layout.cellXY(row, column);
  if (cell.type === 'gate') {
    ctx.fillStyle = colors.cinnabarPrimary;
    ctx.font = font(19, true, gamePack);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(copyText(gamePack, 'battle.gate'), center.x, center.y - 1);
  }
  ctx.restore();
}

function drawWallCourse(ctx, start, end, count, outward = 1) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: dy / length * outward, y: -dx / length * outward };
  for (let index = 0; index < count; index++) {
    const gap = 0.014;
    const first = pointBetween(start, end, index / count + gap);
    const last = pointBetween(start, end, (index + 1) / count - gap);
    const lift = 4.2 + (index % 2) * 0.7;
    const outerFirst = { x: first.x + normal.x * lift, y: first.y + normal.y * lift };
    const outerLast = { x: last.x + normal.x * lift, y: last.y + normal.y * lift };
    const mid = pointBetween(outerFirst, outerLast, 0.5);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(last.x, last.y);
    ctx.quadraticCurveTo(mid.x + normal.x * 0.8, mid.y + normal.y * 0.8, outerLast.x, outerLast.y);
    ctx.lineTo(outerFirst.x, outerFirst.y);
    ctx.quadraticCurveTo(first.x + normal.x * 2, first.y + normal.y * 2, first.x, first.y);
    ctx.closePath();
    ctx.fillStyle = index % 3 === 0 ? '#aaa590' : index % 3 === 1 ? '#918f7e' : '#9c9987';
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,44,39,0.48)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
}

function drawStoneTower(ctx, point, depth, colors, side = 1) {
  const width = 9.5;
  const height = 11;
  ctx.save();
  ctx.translate(point.x + side * 1.5, point.y - 2);
  ctx.fillStyle = '#777a6e';
  ctx.beginPath();
  ctx.moveTo(-width, -height + 3);
  ctx.lineTo(-width + 2, -height);
  ctx.lineTo(width - 2, -height);
  ctx.lineTo(width, -height + 3);
  ctx.lineTo(width - 1.5, depth + 4);
  ctx.lineTo(-width + 1.5, depth + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(37,40,36,0.78)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = '#4f554f';
  ctx.fillRect?.(-width - 1, -height - 2, width * 2 + 2, 5);
  ctx.strokeStyle = colors.paperLight;
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.moveTo(-4, -height + 3);
  ctx.lineTo(-4, depth);
  ctx.stroke();
  ctx.restore();
}

function drawWallGrass(ctx, point, side = 1) {
  ctx.save();
  ctx.translate(point.x + side * 5, point.y + 7);
  ctx.strokeStyle = '#6f7155';
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(0, 4); ctx.quadraticCurveTo(-3 * side, -2, -5 * side, -7);
  ctx.moveTo(1 * side, 4); ctx.quadraticCurveTo(4 * side, 0, 5 * side, -4);
  ctx.moveTo(-1 * side, 4); ctx.quadraticCurveTo(-1 * side, -1, 1 * side, -6);
  ctx.stroke();
  ctx.restore();
}

export function drawCloudArenaFrame(ctx, layout, colors, style) {
  const top = platformPolygon(layout);
  const depth = style.platformDepth ?? 18;
  const blockCount = Math.max(4, Math.round(style.wallBlockCount ?? 8));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawWallCourse(ctx, top[0], top[1], blockCount);
  drawWallCourse(ctx, top[1], top[2], blockCount + 2);
  drawWallCourse(ctx, top[3], top[0], blockCount + 2);
  ctx.strokeStyle = '#a3a596';
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.8;
  polygonPath(ctx, top);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawStoneTower(ctx, top[0], depth, colors, -1);
  drawStoneTower(ctx, top[1], depth, colors, 1);
  drawStoneTower(ctx, top[3], depth, colors, -1);
  drawStoneTower(ctx, top[2], depth, colors, 1);
  drawWallGrass(ctx, top[3], -1);
  drawWallGrass(ctx, top[2], 1);
  ctx.restore();
}

export function drawCloudArenaDecoration(ctx, cell, row, column, layout, colors) {
  if (cell.type !== 'spawn' && cell.decoration !== 'bramble') return;
  const center = layout.cellXY(row, column);
  ctx.save();
  ctx.translate(center.x, center.y + 2);
  ctx.fillStyle = '#202522';
  ctx.strokeStyle = '#0f1210';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-15, 13); ctx.lineTo(-13, -7); ctx.lineTo(-7, 0); ctx.lineTo(-3, -15);
  ctx.lineTo(2, -4); ctx.lineTo(8, -14); ctx.lineTo(10, 1); ctx.lineTo(16, -6);
  ctx.lineTo(14, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#8d9188';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-10, 9); ctx.lineTo(-2, -3); ctx.moveTo(2, 9); ctx.lineTo(8, -4); ctx.stroke();
  ctx.restore();
}

export function traceProjectedCell(ctx, layout, row, column, insetAmount = 2) {
  polygonPath(ctx, inset(layout.cellPolygon(row, column), insetAmount));
}
