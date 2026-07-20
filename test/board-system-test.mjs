import assert from 'node:assert/strict';
import {
  buildBoard,
  commitAtomicTransfer,
  inspectTransfer,
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
  const first = state.bench[0];
  const second = state.bench[1];
  const plan = inspectTransfer(state, {
    source: { zone: 'bench', index: 0 },
    target: { zone: 'bench', index: 1 },
  });
  assert.equal(plan.action, 'swap');
  assert.equal(commitAtomicTransfer(plan).ok, true);
  assert.equal(transferDomainEvent(plan, 4).type, 'board.pieces_swapped');
  assert.equal(state.bench[0], second);
  assert.equal(state.bench[1], first);

  const before = JSON.stringify({ bench: state.bench, grid: state.grid });
  const rejected = inspectTransfer(state, {
    source: { zone: 'bench', index: 1 },
    target: { zone: 'grid', r: 0, c: 7 },
  });
  assert.deepEqual(rejected, { ok: false, reason: 'target-not-open' });
  assert.equal(JSON.stringify({ bench: state.bench, grid: state.grid }), before);
}

console.log('✓ Board 拓扑、路线、原子移动/交换与非法回滚公共契约');
