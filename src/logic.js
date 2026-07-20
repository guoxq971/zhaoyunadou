// 集成兼容门面：给旧调用者注入默认 Game Pack，不再拥有玩法规则。
import { CONFIG } from './config.js';
import { gamePackFor } from './engine-core/public.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { troopDamage } from './systems/attribute/index.js';
import {
  canMerge as systemCanMerge,
  detectHero as systemDetectHero,
  ownedFragChars,
  recruitCost as systemRecruitCost,
  rollGacha as systemRollGacha,
  unlockHero as systemUnlockHero,
} from './systems/economy/index.js';
import { useBrush as useSystemBrush, useShovel as useSystemShovel } from './systems/equipment-items/index.js';

const packOrDefault = (candidate) => candidate?.config ? candidate : DEFAULT_GAME_PACK;

export const recruitCost = (index, gamePack) => systemRecruitCost(index, packOrDefault(gamePack));
export const rollGacha = (random, chars = [], gamePack) => systemRollGacha(random, chars, packOrDefault(gamePack));
export const canMerge = (first, second, gamePack) => systemCanMerge(first, second, packOrDefault(gamePack));
export const detectHero = (grid, row, column, gamePack) => (
  systemDetectHero(grid, row, column, packOrDefault(gamePack))
);
export const unlockHero = (state, hero, gamePack) => systemUnlockHero(state, hero, packOrDefault(gamePack));
export { ownedFragChars };

export function troopDmg(type, level, gamePack) {
  const config = gamePack?.config ?? CONFIG;
  return troopDamage(config.troops[type].dmg, level, config.levelMult);
}

export const useShovel = (state, row, column) => useSystemShovel(state, row, column);
export const useBrush = (state, row, column) => useSystemBrush(
  state,
  row,
  column,
  undefined,
  gamePackFor(state) ?? DEFAULT_GAME_PACK,
);
