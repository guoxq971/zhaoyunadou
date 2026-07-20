// 纯函数逻辑:抽卡 / 合成 / 英雄拼字 / 铲子 —— 全部可离线单测
import { CONFIG } from './config.js';
import { eventsFor, gamePackFor } from './engine-core/runtime-context.js';
import { cellAt } from './systems/board/index.js';
import { troopDamage } from './systems/attribute/index.js';
import { createHeroParts, ensurePieceIdentity, transformPiece } from './systems/piece/index.js';

const configFrom = (value) => value?.config ?? gamePackFor(value)?.config ?? CONFIG;

export const recruitCost = (i, gamePack) => configFrom(gamePack).recruitCost(i);

// 抽卡。ownedChars:场上+营栏已有的英雄单字,用于配对加权(已有搭档的字概率×2)
export function rollGacha(rand, ownedChars = [], gamePack) {
  const config = configFrom(gamePack);
  const hasUnmatchedHeroChar = Object.values(config.heroes).some(({ chars: [a, b] }) =>
    (ownedChars.includes(a) && !ownedChars.includes(b)) ||
    (ownedChars.includes(b) && !ownedChars.includes(a)));
  const pool = config.gachaWeights.map((entry) =>
    entry.kind === 'frag' && hasUnmatchedHeroChar
      ? { ...entry, w: entry.w * config.gachaPairing.categoryBoost }
      : entry);
  const total = pool.reduce((s, e) => s + e.w, 0);
  let x = rand() * total;
  let picked = pool[pool.length - 1];
  for (const e of pool) { if ((x -= e.w) < 0) { picked = e; break; } }
  if (picked.kind === 'troop') return { kind: 'troop', type: picked.type, level: 1 };
  if (picked.kind === 'shovel') return { kind: 'shovel' };
  // 英雄单字:凑对加权
  const chars = [];
  for (const h of Object.values(config.heroes)) {
    for (let i = 0; i < 2; i++) {
      const c = h.chars[i], partner = h.chars[1 - i];
      chars.push({
        c,
        w: ownedChars.includes(partner) && !ownedChars.includes(c)
          ? config.gachaPairing.partnerBoost
          : 1,
      });
    }
  }
  const tw = chars.reduce((s, e) => s + e.w, 0);
  let y = rand() * tw;
  for (const e of chars) { if ((y -= e.w) < 0) return { kind: 'frag', char: e.c, level: 1 }; }
  return { kind: 'frag', char: chars[0].c, level: 1 };
}

export function canMerge(a, b, gamePack) {
  const config = configFrom(gamePack);
  if (!a || !b || a.kind !== b.kind) return false;
  const aLevel = a.level ?? 1;
  const bLevel = b.level ?? 1;
  if (aLevel !== bLevel) return false;
  if (a.kind === 'frag') return a.char === b.char && aLevel < config.maxLevel;
  if (a.kind !== 'troop' || a.type !== b.type) return false;
  const cap = config.troops[a.type]?.maxLevel ?? config.maxLevel;
  return aLevel < cap;
}

export const troopDmg = (type, level, gamePack) => {
  const config = configFrom(gamePack);
  return troopDamage(config.troops[type].dmg, level, config.levelMult);
};

// 放下一个英雄单字后,检查 (r,c) 周围是否拼出「左字·右字」水平相邻的全名
// 返回 {key, r, c}(c 为左字所在列)或 null
export function detectHero(grid, r, c, gamePack) {
  const config = configFrom(gamePack);
  const me = cellAt(grid, r, c)?.unit;
  if (!me || me.kind !== 'frag') return null;
  for (const [key, h] of Object.entries(config.heroes)) {
    const [a, b] = h.chars;
    if (me.char === a) {
      const right = cellAt(grid, r, c + 1)?.unit;
      if (right && right.kind === 'frag' && right.char === b && (right.level ?? 1) === (me.level ?? 1)) {
        return { key, r, c, level: me.level ?? 1 };
      }
    }
    if (me.char === b) {
      const left = cellAt(grid, r, c - 1)?.unit;
      if (left && left.kind === 'frag' && left.char === a && (left.level ?? 1) === (me.level ?? 1)) {
        return { key, r, c: c - 1, level: me.level ?? 1 };
      }
    }
  }
  return null;
}

export function unlockHero(state, { key, r, c, level = 1 }, gamePack) {
  const config = configFrom(gamePack ?? state);
  const [left, right] = createHeroParts(state, key, level, [
    { zone: 'grid', r, c },
    { zone: 'grid', r, c: c + 1 },
  ]);
  state.grid[r][c].unit = left;
  state.grid[r][c + 1].unit = right;
  const h = config.heroes[key];
  state.heroes.push({
    key, r, c, level, cd: 0,
    ultCd: h.ultCd * (h.initialUltCooldownRatio ?? 0.5),
  });
  state.lastHeroUnlocked = key;
  if (state.stats) state.stats.heroUnlocks = (state.stats.heroUnlocks ?? 0) + 1;
  eventsFor(state)?.emit('hero_unlock', state, {
    result: 'success', reason: 'pair-completed', heroId: key,
  });
}

export function useShovel(state, r, c) {
  const cell = cellAt(state.grid, r, c);
  if (!cell || cell.type !== 'locked' || state.shovels <= 0) return false;
  cell.type = 'open';
  state.shovels--;
  if (state.stats) state.stats.shovelsUsed = (state.stats.shovelsUsed ?? 0) + 1;
  return true;
}

// 逆天改命笔：把一个已部署普通单位改成本关代表英雄当前缺少的字。
export function useBrush(state, r, c) {
  const cell = cellAt(state.grid, r, c);
  if (!cell?.unit || !['troop', 'frag'].includes(cell.unit.kind) || state.brushes <= 0) return false;
  const config = configFrom(state);
  const featured = config.heroes[state.stage.featuredHero];
  if (!featured) return false;
  const [first, second] = featured.chars;
  const owned = ownedFragChars(state).filter((char, index, chars) => {
    // 若目标本来就是碎字，只从候选集合中移除它这一次，避免自身影响“缺字”判断。
    if (cell.unit.kind !== 'frag' || char !== cell.unit.char) return true;
    return index !== chars.indexOf(char);
  });
  const char = owned.includes(first) && !owned.includes(second)
    ? second
    : owned.includes(second) && !owned.includes(first) ? first : first;
  ensurePieceIdentity(state, cell.unit);
  transformPiece(cell.unit, { kind: 'frag', char, level: 1 });
  state.brushes--;
  if (state.stats) state.stats.brushUses = (state.stats.brushUses ?? 0) + 1;
  return { char, hero: detectHero(state.grid, r, c, gamePackFor(state)) };
}

// 场上 + 营栏所有英雄单字(供抽卡加权)
export function ownedFragChars(state) {
  const out = [];
  for (const row of state.grid) for (const cell of row)
    if (cell.unit?.kind === 'frag') out.push(cell.unit.char);
  for (const b of state.bench) if (b?.kind === 'frag') out.push(b.char);
  return out;
}
