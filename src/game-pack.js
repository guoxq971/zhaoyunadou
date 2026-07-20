// 浏览器 composition root：当前选择《赵云与阿斗》作为第一个 Game Pack。
import { manifests } from '../games/zhaoyun-adou/generated-manifests.js';
import { compileMergeDefenseConfig } from './rulesets/merge-defense/compile-config.js';
import { createGamePack } from './engine-core/public.js';
import { defineContentPack } from './systems/content-pack/index.js';
import { configureLegacyPresentationGamePack } from './systems/skin-presentation/index.js';

export const ZHAOYUN_ADOU_MANIFESTS = manifests;
const zhaoyunAdouDefinition = defineContentPack(manifests);

// ContentPackDefinition 是纯数据；含函数的 RuntimeGamePack 只在集成装配根编译。
export const DEFAULT_GAME_PACK = createGamePack(zhaoyunAdouDefinition.manifests, {
  baseUrl: new URL('../games/zhaoyun-adou/', import.meta.url),
  compileRuleset: compileMergeDefenseConfig,
});

// 旧 root renderer 允许省略 Pack；默认选择仍只发生在 composition root。
configureLegacyPresentationGamePack(DEFAULT_GAME_PACK);
