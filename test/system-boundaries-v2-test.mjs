import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ownershipPath = join(root, 'architecture/system-ownership.json');
const requiredSystemIds = [
  'foundation-runtime', 'content-pack', 'match-controller', 'board-route',
  'piece-model', 'economy-formation', 'attribute', 'combat', 'skill-status',
  'equipment-items', 'stage-encounter', 'progress-save', 'ui-interaction',
  'skin-presentation', 'platform-services', 'integration-quality',
];
const requiredFields = [
  'systemId', 'ownedPaths', 'ownerRole', 'ownedStateSlice', 'publicEntry',
  'allowedDependencies', 'commands', 'publishesDomainEvents',
  'consumesDomainEvents', 'requiredTests',
];

const exists = async (path) => access(path).then(() => true, () => false);

async function filesBelow(path, predicate = (entry) => /\.(?:js|mjs|cjs)$/.test(entry.name)) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(child, predicate));
    else if (entry.isFile() && predicate(entry)) files.push(child);
  }
  return files;
}

function owns(pattern, path) {
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3);
    return path === base || path.startsWith(`${base}/`);
  }
  return pattern === path;
}

function ownersFor(systems, path) {
  return systems.filter((system) => system.ownedPaths.some((pattern) => owns(pattern, path)));
}

function resolveImport(source, specifier) {
  if (!specifier.startsWith('.')) return null;
  return normalize(relative(root, resolve(dirname(source), specifier))).replaceAll('\\', '/');
}

function normalizeImportedFile(path) {
  return /\.(?:js|mjs|cjs)$/.test(path) ? path : `${path}.js`;
}

const manifest = JSON.parse(await readFile(ownershipPath, 'utf8'));
for (const path of [
  'src/**', 'games/zhaoyun-adou/**', 'scripts/**', '.github/**',
  'architecture/**', 'docs/architecture/**', 'AGENTS.md', 'README.md', 'package.json',
]) assert.ok(manifest.governedPaths.includes(path), `governedPaths 缺少工程治理路径: ${path}`);
const { FIXED_ROUTE_UPDATE_ORDER } = await import('../src/game-loop.js');
assert.equal(manifest.schemaVersion, '2.0.0');
assert.equal(manifest.contractVersion, '1.0.0');
assert.equal(manifest.temporaryImportExceptions.length, 0,
  '阶段 G 完成后不得保留活动中的跨系统 import 例外');
assert.deepEqual(manifest.systems.map((system) => system.systemId).sort(), [...requiredSystemIds].sort());
assert.deepEqual(manifest.systemUpdateOrder, [...FIXED_ROUTE_UPDATE_ORDER],
  '机器清单必须与固定路线模式导出的确定性更新顺序一致');
const gameLoopSource = await readFile(join(root, 'src/game-loop.js'), 'utf8');
const orderedCalls = [
  'advanceSimulationTime(state, dt)',
  'itemRegistry.get(generatorId).update(state, dt)',
  'updateWaves(state, dt)',
  'updateEnemies(state, dt, cellXY)',
  'updateUnits(state, dt, cellXY)',
  'updateHeroes(state, dt, cellXY)',
  'updateDragonDamage(state, cellXY)',
  'updateProjectiles(state, dt, cellXY)',
  'advanceSkillEntities(state, dt)',
  'updateEffects(state, dt)',
];
let previousCallIndex = -1;
for (const call of orderedCalls) {
  const callIndex = gameLoopSource.indexOf(call, previousCallIndex + 1);
  assert.ok(callIndex > previousCallIndex, `game-loop 缺少或乱序调用: ${call}`);
  previousCallIndex = callIndex;
}

const ids = new Set();
const slices = new Set();
const commandOwners = new Map();
const eventPublishers = new Map();
const cuePublishers = new Map();
for (const system of manifest.systems) {
  for (const field of requiredFields) assert.ok(Object.hasOwn(system, field), `${system.systemId} 缺少 ${field}`);
  assert.ok(!ids.has(system.systemId), `重复 systemId: ${system.systemId}`);
  ids.add(system.systemId);
  assert.ok(['active', 'migrating', 'planned'].includes(system.migrationStatus));
  assert.ok(system.ownerRole.trim(), `${system.systemId} 必须声明 ownerRole`);
  assert.ok(system.responsibilities.length > 0 && system.nonResponsibilities.length > 0);
  for (const field of ['ownedPaths', 'allowedDependencies', 'commands', 'publishesDomainEvents',
    'consumesDomainEvents', 'requiredTests']) assert.ok(Array.isArray(system[field]), `${system.systemId}.${field} 必须是数组`);
  for (const field of ['ownedPaths', 'allowedDependencies', 'commands', 'publishesDomainEvents',
    'consumesDomainEvents', 'requiredTests']) {
    assert.equal(system[field].length, new Set(system[field]).size, `${system.systemId}.${field} 存在重复项`);
  }
  for (const dependency of system.allowedDependencies) assert.ok(requiredSystemIds.includes(dependency), `${system.systemId} 依赖未知系统 ${dependency}`);
  assert.ok(!system.allowedDependencies.includes(system.systemId), `${system.systemId} 不应声明自依赖`);
  assert.ok(system.ownedPaths.some((pattern) => owns(pattern, system.publicEntry)), `${system.systemId}.publicEntry 不在 ownedPaths`);
  for (const command of system.commands) {
    assert.ok(!commandOwners.has(command), `命令 ${command} 重复归属 ${commandOwners.get(command)} / ${system.systemId}`);
    commandOwners.set(command, system.systemId);
  }
  for (const event of system.publishesDomainEvents) {
    assert.ok(!eventPublishers.has(event), `DomainEvent ${event} 重复发布者`);
    eventPublishers.set(event, system.systemId);
  }
  for (const cue of system.publishesPresentationCues ?? []) {
    assert.ok(!cuePublishers.has(cue), `PresentationCue ${cue} 重复发布者`);
    cuePublishers.set(cue, system.systemId);
  }
  if (system.ownedStateSlice !== null) {
    assert.ok(!slices.has(system.ownedStateSlice), `状态切片重复归属: ${system.ownedStateSlice}`);
    slices.add(system.ownedStateSlice);
  }
  if (system.migrationStatus === 'active') {
    assert.ok(await exists(join(root, system.publicEntry)), `${system.systemId} 公共入口不存在`);
    for (const test of system.requiredTests) assert.ok(await exists(join(root, test)), `${system.systemId} 必需测试不存在: ${test}`);
  }
}

for (const system of manifest.systems) for (const event of system.consumesDomainEvents) {
  assert.ok(eventPublishers.has(event), `${system.systemId} 消费无人发布的 DomainEvent: ${event}`);
}
for (const system of manifest.systems) for (const cue of system.consumesPresentationCues ?? []) {
  assert.ok(cuePublishers.has(cue), `${system.systemId} 消费无人发布的 PresentationCue: ${cue}`);
}
for (const cue of cuePublishers.keys()) {
  assert.ok(!eventPublishers.has(cue), `PresentationCue 不得与 DomainEvent 同名: ${cue}`);
}

// 机器清单必须完整覆盖生产命令目录，避免新增 handler 却没有明确 owner。
const { PLAYER_COMMAND_TYPES } = await import('../src/rulesets/merge-defense/player-command-dispatcher.js');
assert.deepEqual([...commandOwners.keys()].sort(), [...PLAYER_COMMAND_TYPES].sort(), '生产 GameCommand 与所有权清单不一致');

// allowedDependencies 必须保持有向无环；集成总装配只作为叶子依赖方。
function visit(systemId, visiting = new Set(), visited = new Set()) {
  if (visited.has(systemId)) return;
  assert.ok(!visiting.has(systemId), `系统依赖存在环: ${[...visiting, systemId].join(' -> ')}`);
  visiting.add(systemId);
  const system = manifest.systems.find((entry) => entry.systemId === systemId);
  system.allowedDependencies.forEach((dependency) => visit(dependency, visiting, visited));
  visiting.delete(systemId);
  visited.add(systemId);
}
manifest.systems.forEach((system) => visit(system.systemId));

assert.equal(manifest.integrationOnlyPaths.length, new Set(manifest.integrationOnlyPaths).size);
const integration = manifest.systems.find((system) => system.systemId === 'integration-quality');
const legacyTelemetryOwners = ownersFor(manifest.systems, 'src/engine-core/events.js');
assert.deepEqual(legacyTelemetryOwners.map((system) => system.systemId), ['integration-quality'],
  'engine-core/events.js 是使用墙钟与外部 sink 的兼容 Telemetry，不得归入确定性 foundation');
for (const path of manifest.integrationOnlyPaths) {
  assert.ok(integration.ownedPaths.some((pattern) => owns(pattern, path)), `集成专属路径未归 integration-quality: ${path}`);
}
for (const rootEntry of manifest.integrationRoots) {
  assert.ok(rootEntry.path && rootEntry.responsibility, 'integration root 必须声明路径与职责');
  assert.ok(await exists(join(root, rootEntry.path)), `integration root 不存在: ${rootEntry.path}`);
  assert.ok(integration.ownedPaths.some((pattern) => owns(pattern, rootEntry.path)),
    `integration root 未归 integration-quality: ${rootEntry.path}`);
}
for (const facade of manifest.compatibilityFacades) {
  for (const field of ['path', 'status', 'lastReviewedPhase', 'realCallers', 'delegatesTo', 'removalCondition']) {
    assert.ok(facade[field], `兼容门面缺少 ${field}`);
  }
  assert.ok(['retained', 'deprecated', 'removable'].includes(facade.status),
    `${facade.path} 兼容状态无效`);
  assert.equal(facade.lastReviewedPhase, 'G', `${facade.path} 必须经阶段 G 复核`);
  assert.equal(Object.hasOwn(facade, 'removeByPhase'), false,
    `${facade.path} 不得保留已到期的 removeByPhase`);
  assert.ok(Array.isArray(facade.realCallers) && facade.realCallers.length > 0,
    `${facade.path} 必须记录真实调用方`);
  assert.ok(await exists(join(root, facade.path)), `兼容门面不存在: ${facade.path}`);
}

// governedPaths 是唯一的治理扫描来源；不允许测试另写一份目录清单后漏掉 CI/文档/生成脚本。
const governedFiles = [];
for (const pattern of manifest.governedPaths) {
  if (pattern.endsWith('/**')) {
    governedFiles.push(...await filesBelow(join(root, pattern.slice(0, -3)), () => true));
  } else if (await exists(join(root, pattern))) {
    governedFiles.push(join(root, pattern));
  }
}
assert.equal(governedFiles.length, new Set(governedFiles).size, 'governedPaths 不得重叠覆盖同一文件');
for (const file of governedFiles) {
  const path = relative(root, file).replaceAll('\\', '/');
  const owners = ownersFor(manifest.systems, path);
  assert.equal(owners.length, 1, `${path} 必须恰好一个 owner，实际 ${owners.map((owner) => owner.systemId).join(', ') || '无'}`);
}

// 已迁移为 active 的系统只能通过目标系统公共入口跨边界导入；迁移中的旧代码由清单显式追踪。
const importPattern = /(?:\b(?:import|export)\s+(?:[^'"`;]+?\s+from\s+)?|\b(?:import|require)\s*\(\s*)(['"`])([^'"`$]+)\1/g;
const importedSpecifiers = (source) => [...source.matchAll(importPattern)].map((match) => match[2]);
assert.deepEqual(
  importedSpecifiers(`
    import value from '../systems/combat/index.js';
    async function one() { return import('../systems/combat/damage.js'); }
    async function two() { return import(\`../systems/combat/unit-attacks.js\`); }
    function three() { return require('../systems/combat/combat-state.js'); }
  `),
  [
    '../systems/combat/index.js',
    '../systems/combat/damage.js',
    '../systems/combat/unit-attacks.js',
    '../systems/combat/combat-state.js',
  ],
  '边界扫描必须覆盖静态/dynamic import 和 require，禁止绕过公开入口',
);
const exceptionKeys = new Set();
for (const exception of manifest.temporaryImportExceptions) {
  for (const field of ['source', 'target', 'reason', 'removeByPhase']) assert.ok(exception[field], `临时 import 例外缺少 ${field}`);
  assert.doesNotMatch(`${exception.source}${exception.target}`, /[*?]/, '临时 import 例外禁止通配');
  assert.match(exception.removeByPhase, /^[B-G]$/);
  const key = `${exception.source}::${exception.target}`;
  assert.ok(!exceptionKeys.has(key), `重复临时 import 例外: ${key}`);
  exceptionKeys.add(key);
}
const hitExceptions = new Set();
const importViolations = [];
const sourceFiles = await filesBelow(join(root, 'src'));
const repositorySourceFiles = (await Promise.all(
  ['src', 'test', 'games', 'scripts'].map((path) => filesBelow(join(root, path))),
)).flat();
for (const facade of manifest.compatibilityFacades) {
  const actualCallers = [];
  for (const source of repositorySourceFiles) {
    const sourcePath = relative(root, source).replaceAll('\\', '/');
    if (sourcePath === facade.path) continue;
    const text = await readFile(source, 'utf8');
    const importsFacade = importedSpecifiers(text).some((specifier) => {
      const target = resolveImport(source, specifier);
      return target && normalizeImportedFile(target) === facade.path;
    });
    if (importsFacade) actualCallers.push(sourcePath);
  }
  assert.deepEqual(actualCallers.sort(), [...facade.realCallers].sort(),
    `${facade.path}.realCallers 必须与仓库真实反向导入完全一致`);
}
const runtimeDeclarationSource = (await Promise.all(
  sourceFiles.map((file) => readFile(file, 'utf8')),
)).join('\n');
for (const system of manifest.systems) {
  const ownedSources = [];
  for (const pattern of system.ownedPaths) {
    if (pattern.endsWith('/**')) ownedSources.push(...await filesBelow(join(root, pattern.slice(0, -3))));
    else if (/\.(?:js|mjs|cjs)$/.test(pattern) && await exists(join(root, pattern))) {
      ownedSources.push(join(root, pattern));
    }
  }
  const publisherSource = (await Promise.all(
    [...new Set(ownedSources)].map((file) => readFile(file, 'utf8')),
  )).join('\n');
  for (const id of system.publishesDomainEvents) {
    assert.ok(publisherSource.includes(`'${id}'`) || publisherSource.includes(`"${id}"`),
      `${system.systemId} 声明发布 DomainEvent，但所属源码没有该事实定义: ${id}`);
  }
  for (const id of system.consumesDomainEvents) {
    assert.ok(publisherSource.includes(`'${id}'`) || publisherSource.includes(`"${id}"`),
      `${system.systemId} 声明消费 DomainEvent，但所属源码没有该事实落点: ${id}`);
  }
  for (const id of [
    ...system.publishesDomainEvents,
    ...system.consumesDomainEvents,
    ...(system.publishesPresentationCues ?? []),
    ...(system.consumesPresentationCues ?? []),
  ]) {
    assert.ok(runtimeDeclarationSource.includes(`'${id}'`)
      || runtimeDeclarationSource.includes(`"${id}"`),
    `${system.systemId} 声明了没有真实源码落点的事件/Cue: ${id}`);
  }
}
for (const source of sourceFiles) {
  const sourcePath = relative(root, source).replaceAll('\\', '/');
  const sourceOwner = ownersFor(manifest.systems, sourcePath)[0];
  const text = await readFile(source, 'utf8');
  for (const specifier of importedSpecifiers(text)) {
    const targetPath = resolveImport(source, specifier);
    if (!targetPath) continue;
    const targetOwner = ownersFor(manifest.systems, targetPath)[0];
    if (!targetOwner || targetOwner.systemId === sourceOwner.systemId) continue;
    const allowed = sourceOwner.allowedDependencies.includes(targetOwner.systemId)
      && targetPath === targetOwner.publicEntry;
    if (allowed) continue;
    const exceptionKey = `${sourcePath}::${targetPath}`;
    if (exceptionKeys.has(exceptionKey)) hitExceptions.add(exceptionKey);
    else importViolations.push(exceptionKey);
  }
}
assert.deepEqual(importViolations, [], '存在未登记的跨系统依赖/deep import');
assert.deepEqual([...hitExceptions].sort(), [...exceptionKeys].sort(), '存在已经不再命中的陈旧 import 例外');

const forbiddenPlatformGlobals = /\b(?:window|document|localStorage|AudioContext|webkitAudioContext|wx)\b/;
for (const target of ['src/engine-core', 'src/systems', 'src/rulesets', 'games']) {
  for (const file of await filesBelow(join(root, target))) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, forbiddenPlatformGlobals, `${relative(root, file)} 泄漏平台全局`);
  }
}

const deterministicForbidden = /\b(?:Date\.now|performance\.now|Math\.random|crypto\.randomUUID)\b/;
for (const system of manifest.systems.filter((entry) => entry.systemId === 'foundation-runtime')) {
  for (const pattern of system.ownedPaths.filter((entry) => !entry.endsWith('/**'))) {
    if (!/\.(?:js|mjs)$/.test(pattern) || !await exists(join(root, pattern))) continue;
    assert.doesNotMatch(await readFile(join(root, pattern), 'utf8'), deterministicForbidden,
      `${pattern} 的确定性基座禁止使用不可控随机/墙钟`);
  }
}

for (const path of [
  'AGENTS.md',
  'docs/architecture/system-boundaries-v2.md',
  'docs/architecture/migration-plan-v2.md',
  'docs/architecture/multi-maintainer-workflow.md',
  '.github/pull_request_template.md',
  '.github/workflows/quality.yml',
]) assert.ok(await exists(join(root, path)), `缺少治理文件: ${path}`);

console.log(`✓ ${manifest.systems.length} 条系统所有权、公共入口、依赖方向与平台边界契约`);
