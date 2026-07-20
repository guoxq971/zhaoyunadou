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
  const state = createGame();
  const added = ensurePieceIdentity(state, { kind: 'frag', char: '赵', level: 1 });
  assert.equal(added.pieceId, 'piece-5');
  assert.equal(added.revision, 0);
}

console.log('✓ Piece 确定性身份、revision、升级与旧签名兼容');
