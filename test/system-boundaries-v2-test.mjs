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

async function filesBelow(path, predicate = (entry) => /\.(?:js|mjs)$/.test(entry.name)) {
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

const manifest = JSON.parse(await readFile(ownershipPath, 'utf8'));
assert.equal(manifest.schemaVersion, '2.0.0');
assert.equal(manifest.contractVersion, '1.0.0');
assert.deepEqual(manifest.systems.map((system) => system.systemId).sort(), [...requiredSystemIds].sort());

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
for (const path of manifest.integrationOnlyPaths) {
  assert.ok(integration.ownedPaths.some((pattern) => owns(pattern, path)), `集成专属路径未归 integration-quality: ${path}`);
}

// 当前受治理源码必须恰好一个 owner；不能靠 ownerFor() 的首项掩盖重叠。
const governedFiles = [
  ...await filesBelow(join(root, 'src')),
  ...await filesBelow(join(root, 'games/zhaoyun-adou'), () => true),
];
for (const file of governedFiles) {
  const path = relative(root, file).replaceAll('\\', '/');
  const owners = ownersFor(manifest.systems, path);
  assert.equal(owners.length, 1, `${path} 必须恰好一个 owner，实际 ${owners.map((owner) => owner.systemId).join(', ') || '无'}`);
}

// 已迁移为 active 的系统只能通过目标系统公共入口跨边界导入；迁移中的旧代码由清单显式追踪。
const importPattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
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
for (const source of sourceFiles) {
  const sourcePath = relative(root, source).replaceAll('\\', '/');
  const sourceOwner = ownersFor(manifest.systems, sourcePath)[0];
  const text = await readFile(source, 'utf8');
  for (const match of text.matchAll(importPattern)) {
    const targetPath = resolveImport(source, match[1]);
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
