import assert from 'node:assert/strict';
import {
  boardCellType,
  boardPieceAt,
  buildBoard,
  commitAtomicTransfer,
  inspectTransfer,
  listBoardOccupants,
  recordBoardTransfer,
  replaceBoardOccupants,
  restoreBoardPiece,
  transferDomainEvent,
} from '../src/systems/board/index.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGame } from '../src/state.js';

{
  const board = buildBoard(DEFAULT_GAME_PACK, 'julu');
  assert.equal(board.paths.length, 2);
  assert.equal(board.grid[board.paths[0][0].r][board.paths[0][0].c].decoration, 'bramble');
  assert.equal(board.grid[board.paths[1].at(-1).r][board.paths[1].at(-1).c].type, 'gate');
}

{
  const state = createGame();
  const resolveExternalLocation = (location) => {
    if (location?.zone !== 'bench') return null;
    const index = Number(location.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.bench.length) return null;
    return {
      zone: 'bench', index,
      get: () => state.bench[index],
      set: (value) => { state.bench[index] = value; },
    };
  };
  const first = state.bench[0];
  const second = state.bench[1];
  const plan = inspectTransfer(state, {
    source: { zone: 'bench', index: 0 },
    target: { zone: 'bench', index: 1 },
  }, { resolveExternalLocation });
  assert.equal(plan.action, 'swap');
  assert.equal(commitAtomicTransfer(plan).ok, true);
  assert.equal(transferDomainEvent(plan, 4).type, 'board.pieces_swapped');
  assert.equal(state.bench[0], second);
  assert.equal(state.bench[1], first);

  const before = JSON.stringify({ bench: state.bench, grid: state.grid });
  const rejected = inspectTransfer(state, {
    source: { zone: 'bench', index: 1 },
    target: { zone: 'grid', r: 0, c: 7 },
  }, { resolveExternalLocation });
  assert.deepEqual(rejected, { ok: false, reason: 'target-not-open' });
  assert.equal(JSON.stringify({ bench: state.bench, grid: state.grid }), before);

  recordBoardTransfer(state, 'swap');
  assert.equal(state.stats.swaps, 1, 'Board 必须拥有移动/交换统计写入');

  const open = state.grid.flatMap((row, r) => row.map((cell, c) => ({ cell, r, c })))
    .find(({ cell }) => cell.type === 'open' && !cell.unit);
  const restored = { kind: 'troop', type: 'dao', level: 1 };
  assert.equal(restoreBoardPiece(state, { r: open.r, c: open.c }, restored).ok, true);
  assert.equal(open.cell.unit, restored);

  const replacement = { kind: 'hero', key: 'zhaoyun', part: 0, level: 1 };
  assert.equal(replaceBoardOccupants(state, [{
    r: open.r, c: open.c, expected: restored, next: replacement,
  }]).ok, true);
  assert.equal(open.cell.unit, replacement);

  const occupants = listBoardOccupants(state);
  const restoredView = occupants.find(({ row, column }) => row === open.r && column === open.c);
  assert.equal(restoredView.piece.kind, 'hero');
  assert.equal(Object.isFrozen(restoredView), true);
  assert.equal(Object.isFrozen(restoredView.piece), true, '跨系统遍历只能获得只读 Piece View');
  assert.equal(boardPieceAt(state, open.r, open.c), replacement,
    '需要通过 Piece 公共操作变更弈子时，Board 提供窄定位句柄');
  assert.equal(boardCellType(state, open.r, open.c), 'open');
  assert.equal(boardCellType(state, -1, 99), null);
}

console.log('✓ Board 拓扑、路线、原子移动/交换与非法回滚公共契约');
