import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFoundationStateSlice, getStateSlice } from '../src/engine-core/public.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createGame, STATE_FACADE_OWNERS, STATE_SLICE_KEYS } from '../src/state.js';
import { createBoardStateSlice } from '../src/systems/board/index.js';
import { createCombatStateSlice } from '../src/systems/combat/index.js';
import { createEconomyStateSlice } from '../src/systems/economy/index.js';
import { createEquipmentItemsStateSlice } from '../src/systems/equipment-items/index.js';
import { createFixedRouteMatchStateSlice } from '../src/systems/match-mode/index.js';
import { createProgressStateSlice } from '../src/systems/progress-save/index.js';
import { createSkillStatusStateSlice } from '../src/systems/skill-status/index.js';
import { createPresentationStateSlice } from '../src/systems/skin-presentation/index.js';
import { createStageEncounterStateSlice } from '../src/systems/stage-encounter/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(root, 'architecture/system-ownership.json'), 'utf8'));

async function sourceFilesBelow(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFilesBelow(child));
    else if (entry.isFile() && /\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(child);
  }
  return files;
}

const systemBySlice = new Map(
  manifest.systems
    .filter(({ ownedStateSlice }) => ownedStateSlice !== null)
    .map((system) => [system.ownedStateSlice, system.systemId]),
);
const topLevelOwner = new Map();
for (const [sliceId, keys] of Object.entries(STATE_SLICE_KEYS)) {
  const owner = systemBySlice.get(sliceId);
  assert.ok(owner, `状态切片 ${sliceId} 必须在机器清单中有 owner`);
  for (const key of keys) topLevelOwner.set(key, owner);
}
for (const [facade, childOwners] of Object.entries(STATE_FACADE_OWNERS)) {
  for (const [child, sliceId] of Object.entries(childOwners)) {
    assert.ok(systemBySlice.has(sliceId), `${facade}.${child} 引用未知切片 ${sliceId}`);
  }
}

const composedState = createGame();
for (const { systemId, ownedStateSlice } of manifest.systems) {
  if (ownedStateSlice === null) continue;
  assert.doesNotThrow(
    () => getStateSlice(composedState, ownedStateSlice),
    `${systemId} 声明的状态切片 ${ownedStateSlice} 必须由组合根真实安装`,
  );
}

const config = DEFAULT_GAME_PACK.config;
const matchSlice = createFixedRouteMatchStateSlice({ stageIndex: 0, gamePack: DEFAULT_GAME_PACK });
const factorySlices = {
  foundation: createFoundationStateSlice(),
  match: matchSlice,
  progress: createProgressStateSlice({ clearedStars: 0, stageCount: config.campaign.stages.length }),
  board: createBoardStateSlice(DEFAULT_GAME_PACK, matchSlice.stage.mapId),
  economy: createEconomyStateSlice({ config, stage: matchSlice.stage }),
  equipmentItems: createEquipmentItemsStateSlice({ config }),
  skillStatus: createSkillStatusStateSlice(),
  combat: createCombatStateSlice(),
  presentation: createPresentationStateSlice(),
  encounter: createStageEncounterStateSlice({ config, stage: matchSlice.stage }),
};
for (const [sliceId, keys] of Object.entries(STATE_SLICE_KEYS)) {
  for (const key of keys) assert.ok(Object.hasOwn(factorySlices[sliceId], key),
    `${sliceId} 公共工厂必须真实初始化 ${key}`);
}
for (const [stat, sliceId] of Object.entries(STATE_FACADE_OWNERS.stats)) {
  assert.ok(Object.hasOwn(factorySlices[sliceId].stats ?? {}, stat),
    `${sliceId} 公共工厂必须真实初始化 stats.${stat}`);
}

function directTopLevelWrites(source) {
  const writes = [];
  for (const key of topLevelOwner.keys()) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const access = `(?:\\.${escaped}|\\[['"]${escaped}['"]\\])`;
    const pattern = new RegExp(
      `\\bstate${access}\\s*(?:\\+\\+|--|[+\\-*/]?=)|`
      + `\\bstate${access}\\.(?:push|pop|splice|shift|unshift|sort|reverse)\\s*\\(`,
      'g',
    );
    if (pattern.test(source)) writes.push(key);
  }
  return writes;
}

assert.deepEqual(
  directTopLevelWrites("state.mantou += 1; state['enemies'].push(enemy); const x = state.grid;").sort(),
  ['enemies', 'mantou'],
  '状态写入扫描器必须自证能覆盖点号/括号写入并区分只读',
);

for (const system of manifest.systems.filter(({ ownedPaths }) => (
  ownedPaths.some((path) => path.startsWith('src/systems/'))
))) {
  // systemId 与目录名不总是相同，通过 ownedPaths 找真实系统目录。
  const roots = system.ownedPaths
    .filter((path) => path.startsWith('src/systems/') && path.endsWith('/**'))
    .map((path) => join(root, path.slice(0, -3)));
  for (const ownedRoot of roots) {
    for (const file of await sourceFilesBelow(ownedRoot)) {
      const source = await readFile(file, 'utf8');
      for (const key of directTopLevelWrites(source)) {
        assert.equal(
          topLevelOwner.get(key),
          system.systemId,
          `${relative(root, file)} 越权写入 ${key}，owner 应为 ${topLevelOwner.get(key)}`,
        );
      }
      for (const match of source.matchAll(
        /\bgetStateSlice\s*\(\s*state\s*,\s*(['"])([^'"]+)\1\s*\)/g,
      )) {
        assert.equal(
          match[2],
          system.ownedStateSlice,
          `${relative(root, file)} 通过 getStateSlice 访问 ${match[2]}，本系统只拥有 ${system.ownedStateSlice}`,
        );
      }
    }
  }
}

const read = (path) => readFile(join(root, path), 'utf8');
const economySource = (await Promise.all([
  read('src/systems/economy/recruitment.js'),
  read('src/systems/economy/formation.js'),
  read('src/systems/economy/command-handlers.js'),
])).join('\n');
assert.doesNotMatch(economySource, /state\.shovels\s*(?:\+\+|--|[+\-*/]?=)/,
  'Economy 不得写 Equipment 库存');
assert.doesNotMatch(economySource, /state\.grid[^;\n]*\.unit\s*=/,
  'Economy 不得直写 Board 占用');
assert.doesNotMatch(economySource, /state\.(?:heroes|lastHeroUnlocked)\s*(?:\.|=)/,
  'Economy 不得写 Skill/Status 英雄状态');
assert.doesNotMatch(economySource, /state\.stats\.(?:heroUnlocks|moves|swaps)\s*(?:\+\+|--|[+\-*/]?=)/,
  'Economy 不得写 Skill/Board 统计');

assert.doesNotMatch(await read('src/systems/board/index.js'), /state\.bench/,
  'Board 必须通过 Economy external-location port 访问营栏');
assert.doesNotMatch(await read('src/systems/match-mode/fixed-route-campaign.js'),
  /state\.time\s*(?:\+\+|--|[+\-*/]?=)/,
  'MatchMode 必须通过 Foundation 时钟窄口');
assert.doesNotMatch(await read('src/systems/skin-presentation/index.js'),
  /\.(?:hitFlash|flash)\s*=/,
  'Skin 不得回写 Combat/Piece 实体');
assert.doesNotMatch((await Promise.all([
  read('src/app-shell/create-game-app.js'),
  read('src/campaign.js'),
])).join('\n'), /state\.(?:clearedStars|saved|saveWarning)\s*(?:\+\+|--|[+\-*/]?=)/,
  'Integration 必须通过 Progress/Save 窄口投影存档结果');
assert.doesNotMatch((await Promise.all([
  read('src/enemies.js'),
  read('src/heroes.js'),
])).join('\n'), /enemy\.stun\s*(?:\+\+|--|[+\-*/]?=)/,
  'Integration 不得在 Combat 实体中镜像 Skill Status');
assert.doesNotMatch(await read('src/units.js'), /\.flash\s*(?:\+\+|--|[+\-*/]?=)/,
  'Integration 不得直写 Piece 反馈字段');
assert.doesNotMatch((await Promise.all([
  read('src/systems/piece/index.js'),
  read('src/systems/skill-status/system.js'),
])).join('\n'), /\b(?:piece|hero)\.flash\s*(?:\+\+|--|[+\-*/]?=)/,
  'Piece/Skill 不得把动画 flash 写入玩法实体');
assert.doesNotMatch((await Promise.all([
  read('src/systems/economy/recruitment.js'),
  read('src/systems/economy/formation.js'),
  read('src/systems/economy/command-handlers.js'),
  read('src/systems/equipment-items/command-handlers.js'),
])).join('\n'), /\b(?:eventsFor|telemetryFor)\s*\(/,
  '规则系统只能发布 DomainEvent，不得直接调用 Telemetry');
assert.doesNotMatch(await read('src/state.js'), /Object\.assign\(getStateSlice/,
  '状态组合根必须消费系统切片工厂，不得自行补写私有字段');
assert.doesNotMatch(await read('src/state.js'), /startMantou|startLives|startShovels|startBrushes|featuredHero\]\.chars/,
  '状态组合根不得继续拥有经济、遭遇、装备或代表英雄初始化规则');

assert.doesNotMatch(await read('src/systems/combat/unit-attacks.js'), /state\.grid/,
  'Combat 必须通过 Board/Piece 公共查询遍历弈子，不得直读 Board 切片');
assert.doesNotMatch((await Promise.all([
  read('src/systems/economy/index.js'),
  read('src/systems/economy/command-handlers.js'),
  read('src/systems/economy/formation.js'),
  read('src/systems/economy/rules.js'),
])).join('\n'), /state\.grid/,
  'Economy 必须通过 Board/Piece 公共入口读取占用和弈子');
assert.doesNotMatch((await Promise.all([
  read('src/systems/equipment-items/operations.js'),
  read('src/systems/equipment-items/command-handlers.js'),
])).join('\n'), /state\.grid/,
  'Equipment 必须通过 Board 窄口定位目标');
assert.doesNotMatch(await read('src/systems/stage-encounter/stage-encounter.js'),
  /state\.(?:stage|title|over|time)\b/,
  'Stage/Encounter 必须通过组合根注入的只读窄口获取 Match/Foundation 事实');

console.log('✓ 状态切片归属、跨系统窄口与已知别名写入防回归');
