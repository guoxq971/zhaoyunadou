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
export function createSemanticLayout(config, { rects = DEFAULT_UI_RECTS } = {}) {
  const board = config?.board ?? config;
  assertBoard(board);
  const frozenBoard = Object.freeze({ ...board });
  const ui = Object.freeze(Object.fromEntries(
    Object.entries(rects).map(([id, rect]) => [id, copyRect(rect)]),
  ));
  const boardWidth = frozenBoard.cols * frozenBoard.cellW;
  const boardHeight = frozenBoard.rows * frozenBoard.cellH;
  const cellXY = (row, column) => Object.freeze({
    x: frozenBoard.ox + (column + 0.5) * frozenBoard.cellW,
    y: frozenBoard.oy + (row + 0.5) * frozenBoard.cellH,
  });
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
    const column = Math.floor((x - frozenBoard.ox) / frozenBoard.cellW);
    const row = Math.floor((y - frozenBoard.oy) / frozenBoard.cellH);
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
    ui,
    cellXY,
    benchRect,
    toolRect,
    titleStageRect,
    boardCell,
    inRect,
  });
}

export { DEFAULT_UI_RECTS };
