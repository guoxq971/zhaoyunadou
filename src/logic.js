// 纯函数逻辑:抽卡 / 合成 / 英雄拼字 / 铲子 —— 全部可离线单测
import { CONFIG } from './config.js';
import { cellAt } from './state.js';

export const recruitCost = (i) => CONFIG.recruitCost(i);

// 抽卡。ownedChars:场上+营栏已有的英雄单字,用于配对加权(已有搭档的字概率×2)
export function rollGacha(rand, ownedChars = []) {
  const pool = CONFIG.gachaWeights;
  const total = pool.reduce((s, e) => s + e.w, 0);
  let x = rand() * total;
  let picked = pool[pool.length - 1];
  for (const e of pool) { if ((x -= e.w) < 0) { picked = e; break; } }
  if (picked.kind === 'troop') return { kind: 'troop', type: picked.type, level: 1 };
  if (picked.kind === 'shovel') return { kind: 'shovel' };
  // 英雄单字:凑对加权
  const chars = [];
  for (const h of Object.values(CONFIG.heroes)) {
    for (let i = 0; i < 2; i++) {
      const c = h.chars[i], partner = h.chars[1 - i];
      chars.push({ c, w: ownedChars.includes(partner) && !ownedChars.includes(c) ? 2 : 1 });
    }
  }
  const tw = chars.reduce((s, e) => s + e.w, 0);
  let y = rand() * tw;
  for (const e of chars) { if ((y -= e.w) < 0) return { kind: 'frag', char: e.c }; }
  return { kind: 'frag', char: chars[0].c };
}

export function canMerge(a, b) {
  if (!a || !b || a.kind !== 'troop' || b.kind !== 'troop') return false;
  if (a.type !== b.type || a.level !== b.level) return false;
  const cap = a.type === 'nong' ? 3 : CONFIG.maxLevel; // 农最高 3 级
  return a.level < cap;
}

export const troopDmg = (type, level) =>
  Math.round(CONFIG.troops[type].dmg * Math.pow(CONFIG.levelMult, level - 1));

// 放下一个英雄单字后,检查 (r,c) 周围是否拼出「左字·右字」水平相邻的全名
// 返回 {key, r, c}(c 为左字所在列)或 null
export function detectHero(grid, r, c) {
  const me = cellAt(grid, r, c)?.unit;
  if (!me || me.kind !== 'frag') return null;
  for (const [key, h] of Object.entries(CONFIG.heroes)) {
    const [a, b] = h.chars;
    if (me.char === a) {
      const right = cellAt(grid, r, c + 1)?.unit;
      if (right && right.kind === 'frag' && right.char === b) return { key, r, c };
    }
    if (me.char === b) {
      const left = cellAt(grid, r, c - 1)?.unit;
      if (left && left.kind === 'frag' && left.char === a) return { key, r, c: c - 1 };
    }
  }
  return null;
}

export function unlockHero(state, { key, r, c }) {
  state.grid[r][c].unit = { kind: 'hero', key, part: 0 };
  state.grid[r][c + 1].unit = { kind: 'hero', key, part: 1 };
  const h = CONFIG.heroes[key];
  state.heroes.push({ key, r, c, cd: 0, ultCd: h.ultCd * 0.5 });
}

export function useShovel(state, r, c) {
  const cell = cellAt(state.grid, r, c);
  if (!cell || cell.type !== 'locked' || state.shovels <= 0) return false;
  cell.type = 'open';
  state.shovels--;
  return true;
}

// 场上 + 营栏所有英雄单字(供抽卡加权)
export function ownedFragChars(state) {
  const out = [];
  for (const row of state.grid) for (const cell of row)
    if (cell.unit?.kind === 'frag') out.push(cell.unit.char);
  for (const b of state.bench) if (b?.kind === 'frag') out.push(b.char);
  return out;
}
