// 浏览器 composition root：当前选择《赵云与阿斗》作为第一个 Game Pack。
import { manifests } from '../games/zhaoyun-adou/generated-manifests.js';
import { createGamePack } from './engine-core/game-pack.js';
import { compileMergeDefenseConfig } from './rulesets/merge-defense/compile-config.js';

export const ZHAOYUN_ADOU_MANIFESTS = manifests;
export const DEFAULT_GAME_PACK = createGamePack(manifests, {
  baseUrl: new URL('../games/zhaoyun-adou/', import.meta.url),
  compileRuleset: compileMergeDefenseConfig,
});
