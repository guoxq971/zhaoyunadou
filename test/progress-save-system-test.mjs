import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILE_STORAGE_KEY,
  LEGACY_BEST_WAVE_STORAGE_KEY,
  LEGACY_PROGRESS_STORAGE_KEY,
  SAVE_ENVELOPE_SCHEMA_VERSION,
  SAVE_KINDS,
  createMatchSnapshotEnvelope,
  createProfileProgressEnvelope,
  createProgressSave,
  createReplayEnvelope,
  decodeSaveEnvelope,
  encodeSaveEnvelope,
} from '../src/systems/progress-save/index.js';

const IDENTITY = Object.freeze({
  gameId: 'zhaoyun-adou',
  gameVersion: '1.0.0',
  rulesetVersion: '1.0.0',
  contentVersion: '1.0.0',
});

class MemoryStorage {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
    this.reads = 0;
    this.writes = [];
    this.removals = [];
    this.persistent = true;
  }

  getItem(key) {
    this.reads++;
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
    this.writes.push([key, String(value)]);
    return true;
  }

  removeItem(key) {
    this.values.delete(key);
    this.removals.push(key);
    return true;
  }
}

const repositoryFor = (storage, overrides = {}) => createProgressSave({
  storage,
  identity: IDENTITY,
  stageCount: 5,
  ...overrides,
});

assert.equal(DEFAULT_PROFILE_STORAGE_KEY, 'zyad_profile_progress');
assert.equal(LEGACY_PROGRESS_STORAGE_KEY, 'zyad_cleared_stars');
assert.equal(LEGACY_BEST_WAVE_STORAGE_KEY, 'zyad_best');
assert.deepEqual(Object.values(SAVE_KINDS), ['profile-progress', 'match-snapshot', 'replay']);

{
  const storage = new MemoryStorage({
    [LEGACY_PROGRESS_STORAGE_KEY]: '3',
    [LEGACY_BEST_WAVE_STORAGE_KEY]: '12',
  });
  const loaded = repositoryFor(storage).loadProfileProgress();
  assert.deepEqual(loaded.profile, { clearedStars: 3, bestWave: 12 });
  assert.equal(loaded.source, 'legacy');
  assert.equal(loaded.degraded, false);
  assert.deepEqual(storage.writes, [], '启动读取旧键不得暗中迁移写入');
}

{
  const storage = new MemoryStorage({
    [LEGACY_PROGRESS_STORAGE_KEY]: '5',
    [LEGACY_BEST_WAVE_STORAGE_KEY]: '99',
  });
  const envelope = createProfileProgressEnvelope(
    { clearedStars: 2, bestWave: 7 },
    { identity: IDENTITY },
  );
  storage.values.set(DEFAULT_PROFILE_STORAGE_KEY, encodeSaveEnvelope(envelope));
  const loaded = repositoryFor(storage).loadProfileProgress();
  assert.deepEqual(loaded.profile, { clearedStars: 2, bestWave: 7 });
  assert.equal(loaded.source, 'envelope', '有效 envelope 必须优先于旧键');
  assert.equal(loaded.degraded, false);
  assert.deepEqual(storage.writes, []);
}

{
  const storage = new MemoryStorage({
    [DEFAULT_PROFILE_STORAGE_KEY]: '{broken json',
    [LEGACY_PROGRESS_STORAGE_KEY]: '4',
    [LEGACY_BEST_WAVE_STORAGE_KEY]: '15',
  });
  const loaded = repositoryFor(storage).loadProfileProgress();
  assert.deepEqual(loaded.profile, { clearedStars: 4, bestWave: 15 });
  assert.equal(loaded.source, 'legacy');
  assert.equal(loaded.degraded, true);
  assert.equal(loaded.reason, 'invalid-json');
  assert.deepEqual(storage.writes, [], '损坏存档降级读取也不得在启动时写回');
}

{
  const storage = new MemoryStorage({ [LEGACY_PROGRESS_STORAGE_KEY]: '1' });
  const wrongGame = createProfileProgressEnvelope(
    { clearedStars: 5, bestWave: 30 },
    { identity: { ...IDENTITY, gameId: 'another-game' } },
  );
  storage.values.set(DEFAULT_PROFILE_STORAGE_KEY, encodeSaveEnvelope(wrongGame));
  const loaded = repositoryFor(storage).loadProfileProgress();
  assert.equal(loaded.profile.clearedStars, 1);
  assert.equal(loaded.degraded, true);
  assert.equal(loaded.reason, 'game-id-mismatch');
}

{
  const storage = new MemoryStorage({
    [LEGACY_PROGRESS_STORAGE_KEY]: '1',
    [LEGACY_BEST_WAVE_STORAGE_KEY]: '8',
  });
  const repository = repositoryFor(storage);
  const settled = repository.settleMatchResult({ stageIndex: 1, win: true, bestWave: 11 });
  assert.deepEqual(settled.profile, { clearedStars: 2, bestWave: 11 });
  assert.equal(settled.persisted, true);
  assert.deepEqual(storage.writes.map(([key]) => key), [
    DEFAULT_PROFILE_STORAGE_KEY,
    LEGACY_PROGRESS_STORAGE_KEY,
    LEGACY_BEST_WAVE_STORAGE_KEY,
  ], '结算必须写 envelope 并双写两个旧键');
  assert.equal(storage.values.get(LEGACY_PROGRESS_STORAGE_KEY), '2');
  assert.equal(storage.values.get(LEGACY_BEST_WAVE_STORAGE_KEY), '11');
  const decoded = decodeSaveEnvelope(storage.values.get(DEFAULT_PROFILE_STORAGE_KEY), {
    expectedKind: SAVE_KINDS.PROFILE_PROGRESS,
    expectedGameId: IDENTITY.gameId,
  });
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.envelope.payload, settled.profile);
}

{
  const storage = new MemoryStorage({ [LEGACY_PROGRESS_STORAGE_KEY]: '1' });
  const locked = repositoryFor(storage).settleMatchResult({ stageIndex: 3, win: true, bestWave: 5 });
  assert.deepEqual(locked.profile, { clearedStars: 1, bestWave: 5 }, '结算不得越过未解锁关卡');
}

{
  const attempted = [];
  const storage = {
    persistent: true,
    getItem() { return null; },
    setItem(key) {
      attempted.push(key);
      return key !== LEGACY_PROGRESS_STORAGE_KEY;
    },
  };
  const settled = repositoryFor(storage).settleMatchResult({ stageIndex: 0, win: true, bestWave: 3 });
  assert.equal(settled.persisted, false);
  assert.equal(settled.reason, 'storage-write-failed');
  assert.deepEqual(attempted, [
    DEFAULT_PROFILE_STORAGE_KEY,
    LEGACY_PROGRESS_STORAGE_KEY,
    LEGACY_BEST_WAVE_STORAGE_KEY,
  ], '部分写失败不得短路，应尽量保留可用兼容副本');
}

{
  const storage = new MemoryStorage({
    [DEFAULT_PROFILE_STORAGE_KEY]: 'profile',
    [LEGACY_PROGRESS_STORAGE_KEY]: '5',
    [LEGACY_BEST_WAVE_STORAGE_KEY]: '20',
  });
  assert.equal(repositoryFor(storage).clearProgress(), true);
  assert.deepEqual(new Set(storage.removals), new Set([
    DEFAULT_PROFILE_STORAGE_KEY,
    LEGACY_PROGRESS_STORAGE_KEY,
    LEGACY_BEST_WAVE_STORAGE_KEY,
  ]));
  assert.equal(storage.values.size, 0);
}

{
  const storage = new MemoryStorage();
  const repository = repositoryFor(storage);
  const beforeWrites = storage.writes.length;
  const snapshot = createMatchSnapshotEnvelope(
    { seed: 42, stateHash: 'abc123', state: { wave: 2 } },
    { identity: IDENTITY },
  );
  const replay = createReplayEnvelope(
    { seed: 42, commands: [{ type: 'wave.start', sequence: 1 }] },
    { identity: IDENTITY },
  );
  assert.equal(decodeSaveEnvelope(encodeSaveEnvelope(snapshot), {
    expectedKind: SAVE_KINDS.MATCH_SNAPSHOT,
  }).envelope.kind, SAVE_KINDS.MATCH_SNAPSHOT);
  assert.equal(decodeSaveEnvelope(encodeSaveEnvelope(replay), {
    expectedKind: SAVE_KINDS.REPLAY,
  }).envelope.kind, SAVE_KINDS.REPLAY);
  repository.loadProfileProgress();
  assert.equal(storage.writes.length, beforeWrites, 'Snapshot/Replay codec 和启动读取都不得自动持久化');
}

{
  const legacyEnvelope = JSON.stringify({
    schemaVersion: '0.9.0',
    kind: SAVE_KINDS.PROFILE_PROGRESS,
    ...IDENTITY,
    payload: { stars: 2, bestWave: 4 },
  });
  const migrated = decodeSaveEnvelope(legacyEnvelope, {
    expectedKind: SAVE_KINDS.PROFILE_PROGRESS,
    migrations: {
      '0.9.0': (envelope) => ({
        ...envelope,
        schemaVersion: SAVE_ENVELOPE_SCHEMA_VERSION,
        revision: 0,
        payload: { clearedStars: envelope.payload.stars, bestWave: envelope.payload.bestWave },
      }),
    },
  });
  assert.equal(migrated.ok, true);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.fromSchemaVersion, '0.9.0');
  assert.deepEqual(migrated.envelope.payload, { clearedStars: 2, bestWave: 4 });
}

{
  const bad = decodeSaveEnvelope('{', { expectedKind: SAVE_KINDS.PROFILE_PROGRESS });
  assert.deepEqual(bad, { ok: false, reason: 'invalid-json' });
  const wrongKind = decodeSaveEnvelope(encodeSaveEnvelope(createReplayEnvelope(
    { commands: [] },
    { identity: IDENTITY },
  )), { expectedKind: SAVE_KINDS.PROFILE_PROGRESS });
  assert.equal(wrongKind.ok, false);
  assert.equal(wrongKind.reason, 'kind-mismatch');
}

console.log('✓ SaveEnvelope 版本、分类与迁移链');
console.log('✓ ProfileProgress envelope 优先、旧键兼容与损坏降级');
console.log('✓ 结算双写、清除全键且启动不自动迁移');
