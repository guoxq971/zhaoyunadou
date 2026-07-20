import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { ZHAOYUN_ADOU_MANIFESTS } from '../src/game-pack.js';
import {
  createAssetLoader,
  createGameClock,
  createGamePack,
} from '../src/engine-core/public.js';
import {
  CONTENT_PACK_API_VERSION,
  defineContentPack,
} from '../src/systems/content-pack/index.js';
import { compileMergeDefenseConfig } from '../src/rulesets/merge-defense/compile-config.js';
import { createGame } from '../src/state.js';
import { CONFIG } from '../src/config.js';
import { UI } from '../src/ui-layout.js';
import {
  loadGamePackDirectory,
  validateGamePackDocuments,
} from '../scripts/validate-game-pack.mjs';

assert.equal(DEFAULT_GAME_PACK.id, 'zhaoyun-adou');
assert.deepEqual(Object.keys(DEFAULT_GAME_PACK.versions).sort(), [
  'contentVersion', 'gameVersion', 'presentationVersion', 'rulesetVersion',
]);
assert.equal(DEFAULT_GAME_PACK.config, CONFIG, 'CONFIG must remain the default-pack compatibility view');
assert.equal(CONFIG.recruitCost(0), 16);
assert.equal(CONFIG.recruitCost(4), 44);
assert.equal(CONFIG.waves.size(3), 9);
assert.equal(CONFIG.waves.killReward(5), 3);
assert.equal(CONFIG.waves.waveBonus(5), 18);

{
  const mutableManifests = structuredClone(ZHAOYUN_ADOU_MANIFESTS);
  const definition = defineContentPack(mutableManifests);
  assert.equal(definition.apiVersion, CONTENT_PACK_API_VERSION);
  assert.deepEqual(definition.manifests, ZHAOYUN_ADOU_MANIFESTS);
  assert.equal(Object.isFrozen(definition), true, 'Content Pack 定义外壳必须是只读契约');
  assert.equal(Object.isFrozen(definition.manifests.game), true, 'Content Pack 嵌套 Manifest 必须递归只读');
  mutableManifests.game.id = 'mutated-after-definition';
  assert.equal(definition.manifests.game.id, 'zhaoyun-adou', '定义必须与调用方可变数据隔离');
  assert.doesNotThrow(() => JSON.stringify(definition), 'Content Pack 定义必须保持纯数据');
  assert.doesNotThrow(() => structuredClone(definition), 'Content Pack 定义必须可结构化克隆');
  assert.throws(
    () => defineContentPack({ invalid: () => {} }),
    /serializable/,
    'Content Pack 公共入口必须拒绝可执行内容',
  );
  const pack = createGamePack(definition.manifests, { compileRuleset: compileMergeDefenseConfig });
  assert.equal(pack.id, DEFAULT_GAME_PACK.id);
  assert.equal(pack.config.recruitCost(0), DEFAULT_GAME_PACK.config.recruitCost(0));
  assert.equal(Object.isFrozen(pack.config.board), true, '编译后的嵌套 ruleset config 必须只读');
  assert.throws(() => { pack.config.board.cell = 999; }, TypeError,
    '外部不得修改确定性运行配置');
  const contentSource = await readFile(
    new URL('../src/systems/content-pack/index.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(contentSource, /compileRuleset|createGamePack/,
    'Content Pack 公共入口只提供纯数据定义，不执行规则编译');
}

{
  const clock = createGameClock(() => 0);
  const assets = createAssetLoader({ manifest: { assets: [] } });
  assert.equal(clock.next(), 0, 'Foundation 公共入口必须暴露真实时钟');
  assert.equal(assets.has('missing'), false, 'Foundation 公共入口必须暴露真实素材加载器');
}

const state = createGame(0, 0, DEFAULT_GAME_PACK);
assert.equal(state.stage.id, 'star-1');
assert.equal(state.path, state.paths[0], 'legacy path alias must survive pack loading');
assert.equal(Object.prototype.hasOwnProperty.call(state, 'gamePack'), false, 'runtime pack must not enter serializable state');
assert.doesNotThrow(() => JSON.stringify(state));

const loaded = await loadGamePackDirectory();
assert.deepEqual(loaded.documents, ZHAOYUN_ADOU_MANIFESTS, '生成模块必须与 JSON Manifest 同步');
assert.deepEqual(validateGamePackDocuments(loaded.documents, loaded.schemas), []);

{
  const { colors, presentation, layout } = loaded.documents.theme;
  assert.equal(colors.openCell, colors.qingPlayableWash, '青绿只能表达玩家可操作格');
  assert.equal(colors.routeLine, colors.inkStructure, '路线骨架必须使用浓墨');
  assert.equal(colors.routeArrow, colors.cinnabarPrimary, '路线方向与入口必须使用朱砂');
  assert.equal(colors.gold, colors.goldReward, '英雄、星级与奖励共享鎏金语义');
  assert.ok(presentation.route.lineWidth < presentation.route.underlayWidth, '路线方向线必须压在轻量底线上');
  assert.ok(presentation.motion.batchStepSeconds > 0, '批量征兵必须具有可配置的顺序节奏');
  assert.deepEqual(layout, UI, 'Theme 布局必须与输入、渲染共用的真实热区保持一致');
}

for (const role of [
  'paperRaised', 'inkStrong', 'inkStructure', 'cinnabarPrimary', 'cinnabarAction',
  'goldReward', 'qingPlayable', 'qingPlayableWash', 'lockedCell', 'openCell',
  'pathCell', 'routeLine', 'routeArrow', 'boardSurface', 'boardFrame',
]) {
  const broken = structuredClone(loaded.documents);
  delete broken.theme.colors[role];
  assert.ok(
    validateGamePackDocuments(broken, loaded.schemas).some((error) => error.includes(role)),
    `缺少语义色 ${role} 时必须明确失败`,
  );
}

{
  const broken = structuredClone(loaded.documents);
  broken.theme.feedback.deploy.effectId = 'effect.dragon';
  assert.ok(
    validateGamePackDocuments(broken, loaded.schemas).some((error) => (
      error.includes('theme.feedback.deploy.effectId')
    )),
    '反馈映射只能选择可安全实例化的 ring/text 表现',
  );
}

{
  const broken = structuredClone(loaded.documents);
  broken.theme.presentation.route.primaryAlpha = 1.2;
  assert.ok(
    validateGamePackDocuments(broken, loaded.schemas).some((error) => (
      error.includes('theme.presentation.route.primaryAlpha')
    )),
    '路线透明度越界必须由 Schema 明确拒绝',
  );
}

{
  const broken = structuredClone(loaded.documents);
  broken.levels.stages[0].featuredHero = 'unknown-hero';
  assert.ok(
    validateGamePackDocuments(broken, loaded.schemas).some((error) => (
      error.includes('featuredHero') && error.includes('unknown-hero')
    )),
    '未知英雄引用必须明确失败',
  );
}

{
  const broken = structuredClone(loaded.documents);
  broken.theme.assetBindings.titleMascot = 'asset.not-found';
  assert.ok(
    validateGamePackDocuments(broken, loaded.schemas).some((error) => (
      error.includes('theme.assetBindings.titleMascot') && error.includes('asset.not-found')
    )),
    '未知素材角色引用必须明确失败',
  );
}

{
  const broken = structuredClone(ZHAOYUN_ADOU_MANIFESTS);
  delete broken.balance.items['luoyang-shovel'];
  assert.throws(
    () => createGamePack(broken, { compileRuleset: compileMergeDefenseConfig }),
    /required item "luoyang-shovel" is missing/,
  );
}

{
  const broken = structuredClone(loaded.documents);
  broken.game.ruleset.version = 'not-semver';
  assert.ok(
    validateGamePackDocuments(broken, loaded.schemas).some((error) => error.includes('game.ruleset.version')),
    '错误版本格式必须由 Schema 拒绝',
  );
}

{
  const customManifests = structuredClone(ZHAOYUN_ADOU_MANIFESTS);
  customManifests.game.id = 'test-pack';
  customManifests.levels.stages[0].name = '注入关卡';
  customManifests.copy.strings['stage.star-1.name'] = '注入关卡';
  customManifests.balance.heroes.zhaoyun.name = '测试赵云';
  const customPack = createGamePack(customManifests, { compileRuleset: compileMergeDefenseConfig });
  const customState = createGame(0, 0, customPack);
  assert.equal(customState.stage.name, '注入关卡');
  assert.equal(customPack.config.heroes.zhaoyun.name, '测试赵云');
  assert.notEqual(customState.path, state.path, '不同 Pack 必须创建独立地图状态');
}

console.log('✓ Game Pack Schema、引用、生成同步、注入与兼容门面');
