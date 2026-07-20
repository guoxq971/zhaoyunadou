import { getStateSlice } from '../../engine-core/public.js';

export const PIECE_MODEL_API_VERSION = '1.0.0';
const fallbackSequences = new WeakMap();

function pieceStateFor(state) {
  try { return getStateSlice(state, 'pieces'); }
  catch {
    if (!fallbackSequences.has(state)) fallbackSequences.set(state, { nextSequence: 0 });
    return fallbackSequences.get(state);
  }
}

function nextPieceId(state) {
  const pieceState = pieceStateFor(state);
  pieceState.nextSequence++;
  return `piece-${pieceState.nextSequence}`;
}

export const isMovablePiece = (piece) => piece?.kind === 'troop' || piece?.kind === 'frag';

export function legacyPieceSignature(piece) {
  if (!piece) return 'empty';
  if (piece.kind === 'troop') return `troop:${piece.type}:${piece.level ?? 1}`;
  if (piece.kind === 'frag') return `frag:${piece.char}:${piece.level ?? 1}`;
  if (piece.kind === 'hero') return `hero:${piece.key}:${piece.part ?? 0}:${piece.level ?? 1}`;
  return String(piece.kind ?? 'unknown');
}

export function pieceSignature(piece) {
  if (!piece?.pieceId) return legacyPieceSignature(piece);
  return `piece:${piece.pieceId}:${piece.revision ?? 0}`;
}

export function matchesPieceExpectation(piece, expected) {
  if (expected === undefined) return true;
  return expected === pieceSignature(piece) || expected === legacyPieceSignature(piece);
}

export function ensurePieceIdentity(state, piece, location = undefined) {
  if (!piece || typeof piece !== 'object') throw new TypeError('[piece] piece is required');
  if (!piece.pieceId) Object.defineProperty(piece, 'pieceId', {
    value: nextPieceId(state), writable: true, configurable: true,
  });
  if (!Number.isInteger(piece.revision) || piece.revision < 0) Object.defineProperty(piece, 'revision', {
    value: 0, writable: true, configurable: true,
  });
  if (location !== undefined && piece.location === undefined) Object.defineProperty(piece, 'location', {
    value: { ...location }, writable: true, configurable: true,
  });
  return piece;
}

export function touchPiece(piece) {
  if (!piece?.pieceId) throw new Error('[piece] identity is required before mutation');
  piece.revision = (piece.revision ?? 0) + 1;
  return piece;
}

export function upgradePiece(piece) {
  piece.level = (piece.level ?? 1) + 1;
  piece.flash = 0.2;
  return touchPiece(piece);
}

export function transformPiece(piece, patch) {
  const identity = { pieceId: piece.pieceId, revision: piece.revision ?? 0, location: piece.location };
  for (const key of Object.keys(piece)) delete piece[key];
  Object.assign(piece, patch, identity);
  return touchPiece(piece);
}

export function setPieceLocation(piece, location) {
  piece.location = location ? { ...location } : null;
  return touchPiece(piece);
}

export function retirePiece(piece) {
  piece.location = null;
  piece.lifecycle = 'removed';
  return touchPiece(piece);
}

export function createHeroParts(state, key, level = 1, locations = []) {
  const pieceId = nextPieceId(state);
  return [0, 1].map((part) => {
    const piece = { kind: 'hero', key, part, level };
    Object.defineProperties(piece, {
      pieceId: { value: pieceId, writable: true, configurable: true },
      revision: { value: 0, writable: true, configurable: true },
      location: { value: locations[part] ? { ...locations[part] } : undefined, writable: true, configurable: true },
    });
    return piece;
  });
}

export function pieceUpgradedDomainEvent(piece, tick) {
  return {
    type: 'piece.upgraded',
    source: 'piece-model',
    tick,
    payload: {
      pieceId: piece.pieceId,
      kind: piece.kind,
      refId: piece.type ?? piece.char ?? piece.key,
      level: piece.level,
      revision: piece.revision,
    },
  };
}
