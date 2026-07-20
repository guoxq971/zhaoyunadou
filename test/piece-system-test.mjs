import assert from 'node:assert/strict';
import { createGame } from '../src/state.js';
import {
  ensurePieceIdentity,
  legacyPieceSignature,
  matchesPieceExpectation,
  pieceUpgradedDomainEvent,
  pieceSignature,
  upgradePiece,
} from '../src/systems/piece/index.js';
import { applyUnitTransfer, unlockHero } from '../src/systems/economy/index.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';

{
  const first = createGame();
  const second = createGame();
  const firstIds = first.bench.filter(Boolean).map(({ pieceId }) => pieceId);
  const secondIds = second.bench.filter(Boolean).map(({ pieceId }) => pieceId);
  assert.deepEqual(firstIds, ['piece-1', 'piece-2', 'piece-3', 'piece-4']);
  assert.deepEqual(secondIds, firstIds, '相同初始状态必须生成相同弈子 ID');
  assert.equal(new Set(firstIds).size, firstIds.length);
  const piece = first.bench[0];
  assert.equal(pieceSignature(piece), 'piece:piece-1:0');
  assert.deepEqual(piece.location, { zone: 'bench', index: 0 });
  assert.equal(legacyPieceSignature(piece), 'troop:qiang:1');
  assert.equal(matchesPieceExpectation(piece, pieceSignature(piece)), true);
  assert.equal(matchesPieceExpectation(piece, legacyPieceSignature(piece)), true, '迁移期继续接受旧签名');
  upgradePiece(piece);
  assert.equal(piece.level, 2);
  assert.equal(piece.revision, 1);
  assert.equal(pieceUpgradedDomainEvent(piece, 6).type, 'piece.upgraded');
  assert.equal(matchesPieceExpectation(piece, 'piece:piece-1:0'), false);
}

{
  const mergeState = createGame();
  const consumedByMerge = mergeState.bench[0];
  const targetCell = mergeState.grid
    .flatMap((row, r) => row.map((cell, c) => ({ cell, r, c })))
    .find(({ cell }) => cell.type === 'open');
  targetCell.cell.unit = ensurePieceIdentity(
    mergeState,
    { kind: 'troop', type: 'qiang', level: 1 },
    { zone: 'grid', r: targetCell.r, c: targetCell.c },
  );
  const merged = applyUnitTransfer(mergeState, {
    source: { zone: 'bench', index: 0 },
    target: { zone: 'grid', r: targetCell.r, c: targetCell.c },
    expectedSource: 'troop:qiang:1',
  }, DEFAULT_GAME_PACK, 1);
  assert.equal(merged.action, 'merge');
  assert.equal(consumedByMerge.lifecycle, 'removed', '合成被消耗的弈子必须进入 removed 生命周期');
  assert.equal(consumedByMerge.revision, 1, '一次合成只能提交一次 retire revision');

  const state = createGame();
  const first = ensurePieceIdentity(state, { kind: 'frag', char: '赵', level: 1 }, { zone: 'grid', r: 4, c: 2 });
  const second = ensurePieceIdentity(state, { kind: 'frag', char: '云', level: 1 }, { zone: 'grid', r: 4, c: 3 });
  state.grid[4][2].unit = first;
  state.grid[4][3].unit = second;
  unlockHero(state, { key: 'zhaoyun', r: 4, c: 2, level: 1 }, DEFAULT_GAME_PACK);
  assert.deepEqual([first.lifecycle, second.lifecycle], ['removed', 'removed'],
    '拼将替换后的两枚碎片必须通过 Piece 公共操作进入 removed 生命周期');
}

{
  const state = createGame();
  const added = ensurePieceIdentity(state, { kind: 'frag', char: '赵', level: 1 });
  assert.equal(added.pieceId, 'piece-5');
  assert.equal(added.revision, 0);
}

console.log('✓ Piece 确定性身份、revision、升级与旧签名兼容');
