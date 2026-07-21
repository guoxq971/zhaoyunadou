const DEFAULT_UI_RECTS = Object.freeze({
  pause: Object.freeze({ x: 40, y: 10, w: 48, h: 48 }),
  recruit: Object.freeze({ x: 142, y: 606, w: 136, h: 62 }),
  shovel: Object.freeze({ x: 44, y: 604, w: 64, h: 64 }),
  speed: Object.freeze({ x: 312, y: 604, w: 64, h: 64 }),
  bench: Object.freeze({ x: 78, y: 542, w: 48, h: 48, gap: 4 }),
  tools: Object.freeze({ x: 48, y: 680, w: 58, h: 52, gap: 6 }),
  restart: Object.freeze({ x: 130, y: 490, w: 160, h: 56 }),
  start: Object.freeze({ x: 110, y: 510, w: 200, h: 68 }),
  callWave: Object.freeze({ x: 138, y: 58, w: 144, h: 34 }),
  stageSelect: Object.freeze({ x: 44, y: 244, w: 60, h: 48, gap: 6 }),
  resetProgress: Object.freeze({ x: 142, y: 690, w: 136, h: 44 }),
  themeSwitch: Object.freeze({ x: 32, y: 67, w: 48, h: 48 }),
});

const copyRect = (rect) => Object.freeze({ ...rect });

function assertBoard(board) {
  for (const key of ['cols', 'rows', 'cellW', 'cellH', 'ox', 'oy']) {
    if (!Number.isFinite(board?.[key])) throw new TypeError(`[ui-layout] board.${key} is required`);
  }
  if (board.cols <= 0 || board.rows <= 0 || board.cellW <= 0 || board.cellH <= 0) {
    throw new RangeError('[ui-layout] board dimensions must be positive');
  }
}

// 语义热区归 UI 系统；Theme 中的同值字段仅作为旧 Game Pack 兼容数据保留。
export function createSemanticLayout(config, {
  rects = DEFAULT_UI_RECTS,
  projection = null,
} = {}) {
  const board = config?.board ?? config;
  assertBoard(board);
  const frozenBoard = Object.freeze({ ...board });
  const ui = Object.freeze(Object.fromEntries(
    Object.entries(rects).map(([id, rect]) => [id, copyRect(rect)]),
  ));
  const boardWidth = frozenBoard.cols * frozenBoard.cellW;
  const boardHeight = frozenBoard.rows * frozenBoard.cellH;
  const perspective = projection?.mode === 'shallow-perspective';
  const projectionSpec = Object.freeze(perspective ? {
    mode: 'shallow-perspective',
    topScale: Number(projection.topScale) || 0.92,
    bottomScale: Number(projection.bottomScale) || 1,
    verticalScale: Number(projection.verticalScale) || 0.9,
  } : { mode: 'orthogonal', topScale: 1, bottomScale: 1, verticalScale: 1 });
  const centerX = frozenBoard.ox + boardWidth / 2;
  const scaleAt = (logicalY) => {
    const progress = (logicalY - frozenBoard.oy) / boardHeight;
    return projectionSpec.topScale
      + (projectionSpec.bottomScale - projectionSpec.topScale) * progress;
  };
  // UI 命中与 Renderer 共用可逆的浅透视映射，避免视觉格与点击格错位。
  const projectPoint = (x, y) => Object.freeze({
    x: centerX + (x - centerX) * scaleAt(y),
    y: frozenBoard.oy + (y - frozenBoard.oy) * projectionSpec.verticalScale,
  });
  const unprojectPoint = (x, y) => {
    const logicalY = frozenBoard.oy
      + (y - frozenBoard.oy) / projectionSpec.verticalScale;
    const scale = scaleAt(logicalY);
    return Object.freeze({
      x: centerX + (x - centerX) / scale,
      y: logicalY,
    });
  };
  const cellXY = (row, column) => projectPoint(
    frozenBoard.ox + (column + 0.5) * frozenBoard.cellW,
    frozenBoard.oy + (row + 0.5) * frozenBoard.cellH,
  );
  const cellPolygon = (row, column) => Object.freeze([
    projectPoint(
      frozenBoard.ox + column * frozenBoard.cellW,
      frozenBoard.oy + row * frozenBoard.cellH,
    ),
    projectPoint(
      frozenBoard.ox + (column + 1) * frozenBoard.cellW,
      frozenBoard.oy + row * frozenBoard.cellH,
    ),
    projectPoint(
      frozenBoard.ox + (column + 1) * frozenBoard.cellW,
      frozenBoard.oy + (row + 1) * frozenBoard.cellH,
    ),
    projectPoint(
      frozenBoard.ox + column * frozenBoard.cellW,
      frozenBoard.oy + (row + 1) * frozenBoard.cellH,
    ),
  ]);
  const benchRect = (index) => Object.freeze({
    x: ui.bench.x + index * (ui.bench.w + ui.bench.gap),
    y: ui.bench.y,
    w: ui.bench.w,
    h: ui.bench.h,
  });
  const toolRect = (index) => Object.freeze({
    x: ui.tools.x + index * (ui.tools.w + ui.tools.gap),
    y: ui.tools.y,
    w: ui.tools.w,
    h: ui.tools.h,
  });
  const titleStageRect = (index) => Object.freeze({
    x: ui.stageSelect.x + index * (ui.stageSelect.w + ui.stageSelect.gap),
    y: ui.stageSelect.y,
    w: ui.stageSelect.w,
    h: ui.stageSelect.h,
  });
  const boardCell = (x, y) => {
    const logical = unprojectPoint(x, y);
    const column = Math.floor((logical.x - frozenBoard.ox) / frozenBoard.cellW);
    const row = Math.floor((logical.y - frozenBoard.oy) / frozenBoard.cellH);
    return row >= 0 && row < frozenBoard.rows && column >= 0 && column < frozenBoard.cols
      ? Object.freeze({ r: row, c: column })
      : null;
  };
  const inRect = (x, y, rect) => (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
  return Object.freeze({
    board: frozenBoard,
    boardWidth,
    boardHeight,
    projection: projectionSpec,
    ui,
    projectPoint,
    unprojectPoint,
    cellXY,
    cellPolygon,
    benchRect,
    toolRect,
    titleStageRect,
    boardCell,
    inRect,
  });
}

const gamePackLayouts = new WeakMap();

// Game Pack 是稳定对象；按包缓存同一份语义布局，避免每帧为 Renderer 分配热区对象。
export function layoutForGamePack(gamePack) {
  if (!gamePack || typeof gamePack !== 'object') {
    throw new TypeError('[ui-layout] gamePack is required');
  }
  if (!gamePackLayouts.has(gamePack)) {
    const projection = gamePack.manifests?.theme?.activeTheme?.boardStyle?.projection ?? null;
    gamePackLayouts.set(gamePack, createSemanticLayout(gamePack.config, { projection }));
  }
  return gamePackLayouts.get(gamePack);
}

export { DEFAULT_UI_RECTS };
