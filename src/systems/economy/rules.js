import { gamePackFor } from '../../engine-core/public.js';
import { boardPieceAt, cellAt, listBoardOccupants } from '../board/index.js';

const configFrom = (value) => {
  const config = value?.config ?? gamePackFor(value)?.config;
  if (!config) throw new TypeError('[economy] compiled Game Pack is required');
  return config;
};

export const recruitCost = (index, gamePack) => configFrom(gamePack).recruitCost(index);

// 抽取是纯规则：随机流由调用者注入，内部不读平台随机源。
export function rollGacha(random, ownedChars = [], gamePack) {
  const config = configFrom(gamePack);
  const hasUnmatchedHeroChar = Object.values(config.heroes).some(({ chars: [first, second] }) => (
    (ownedChars.includes(first) && !ownedChars.includes(second))
    || (ownedChars.includes(second) && !ownedChars.includes(first))
  ));
  const pool = config.gachaWeights.map((entry) => (
    entry.kind === 'frag' && hasUnmatchedHeroChar
      ? { ...entry, w: entry.w * config.gachaPairing.categoryBoost }
      : entry
  ));
  const total = pool.reduce((sum, entry) => sum + entry.w, 0);
  let cursor = random() * total;
  let picked = pool.at(-1);
  for (const entry of pool) {
    cursor -= entry.w;
    if (cursor < 0) { picked = entry; break; }
  }
  if (picked.kind === 'troop') return { kind: 'troop', type: picked.type, level: 1 };
  if (picked.kind === 'shovel') return { kind: 'shovel' };

  const chars = [];
  for (const hero of Object.values(config.heroes)) {
    for (let index = 0; index < 2; index++) {
      const char = hero.chars[index];
      const partner = hero.chars[1 - index];
      chars.push({
        char,
        weight: ownedChars.includes(partner) && !ownedChars.includes(char)
          ? config.gachaPairing.partnerBoost
          : 1,
      });
    }
  }
  const charTotal = chars.reduce((sum, entry) => sum + entry.weight, 0);
  let charCursor = random() * charTotal;
  for (const entry of chars) {
    charCursor -= entry.weight;
    if (charCursor < 0) return { kind: 'frag', char: entry.char, level: 1 };
  }
  return { kind: 'frag', char: chars[0].char, level: 1 };
}

export function canMerge(first, second, gamePack) {
  const config = configFrom(gamePack);
  if (!first || !second || first.kind !== second.kind) return false;
  const firstLevel = first.level ?? 1;
  const secondLevel = second.level ?? 1;
  if (firstLevel !== secondLevel) return false;
  if (first.kind === 'frag') return first.char === second.char && firstLevel < config.maxLevel;
  if (first.kind !== 'troop' || first.type !== second.type) return false;
  const cap = config.troops[first.type]?.maxLevel ?? config.maxLevel;
  return firstLevel < cap;
}

export function detectHero(grid, row, column, gamePack) {
  const config = configFrom(gamePack);
  const piece = cellAt(grid, row, column)?.unit;
  if (!piece || piece.kind !== 'frag') return null;
  for (const [key, hero] of Object.entries(config.heroes)) {
    const [first, second] = hero.chars;
    if (piece.char === first) {
      const right = cellAt(grid, row, column + 1)?.unit;
      if (right?.kind === 'frag' && right.char === second && (right.level ?? 1) === (piece.level ?? 1)) {
        return { key, r: row, c: column, level: piece.level ?? 1 };
      }
    }
    if (piece.char === second) {
      const left = cellAt(grid, row, column - 1)?.unit;
      if (left?.kind === 'frag' && left.char === first && (left.level ?? 1) === (piece.level ?? 1)) {
        return { key, r: row, c: column - 1, level: piece.level ?? 1 };
      }
    }
  }
  return null;
}

export function detectHeroOnBoard(state, row, column, gamePack) {
  const config = configFrom(gamePack);
  const piece = boardPieceAt(state, row, column);
  if (!piece || piece.kind !== 'frag') return null;
  for (const [key, hero] of Object.entries(config.heroes)) {
    const [first, second] = hero.chars;
    if (piece.char === first) {
      const right = boardPieceAt(state, row, column + 1);
      if (right?.kind === 'frag' && right.char === second && (right.level ?? 1) === (piece.level ?? 1)) {
        return { key, r: row, c: column, level: piece.level ?? 1 };
      }
    }
    if (piece.char === second) {
      const left = boardPieceAt(state, row, column - 1);
      if (left?.kind === 'frag' && left.char === first && (left.level ?? 1) === (piece.level ?? 1)) {
        return { key, r: row, c: column - 1, level: piece.level ?? 1 };
      }
    }
  }
  return null;
}

export function ownedFragChars(state) {
  const chars = listBoardOccupants(state, { kind: 'frag' }).map(({ piece }) => piece.char);
  for (const piece of state.bench) if (piece?.kind === 'frag') chars.push(piece.char);
  return chars;
}

export function configForEconomy(value) {
  return configFrom(value);
}
