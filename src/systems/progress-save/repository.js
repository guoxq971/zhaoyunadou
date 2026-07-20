import {
  DEFAULT_PROGRESS_STORAGE_KEYS,
  SAVE_KINDS,
} from './constants.js';
import {
  createProfileProgressEnvelope,
  decodeSaveEnvelope,
  encodeSaveEnvelope,
} from './envelope.js';
import { normalizeProfileProgress, progressAfterMatch } from './profile-progress.js';

const unique = (values) => [...new Set(values.filter(Boolean))];

function assertStorageKey(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`[progress-save] ${field} must be a non-empty string`);
  }
  return value;
}

function resolvedKeys(keys = {}) {
  return Object.freeze({
    profileKey: assertStorageKey(
      keys.profileKey ?? DEFAULT_PROGRESS_STORAGE_KEYS.profileKey,
      'profileKey',
    ),
    legacyProgressKey: assertStorageKey(
      keys.legacyProgressKey ?? DEFAULT_PROGRESS_STORAGE_KEYS.legacyProgressKey,
      'legacyProgressKey',
    ),
    legacyBestWaveKey: assertStorageKey(
      keys.legacyBestWaveKey ?? DEFAULT_PROGRESS_STORAGE_KEYS.legacyBestWaveKey,
      'legacyBestWaveKey',
    ),
  });
}

const read = (storage, key) => {
  try {
    return { ok: true, value: storage?.getItem?.(key) ?? null };
  } catch {
    return { ok: false, value: null, reason: 'storage-read-failed' };
  }
};

const write = (storage, key, value) => {
  try { return storage?.setItem?.(key, value) !== false && typeof storage?.setItem === 'function'; }
  catch { return false; }
};

const remove = (storage, key) => {
  try { return storage?.removeItem?.(key) !== false && typeof storage?.removeItem === 'function'; }
  catch { return false; }
};

export function createProgressSave({
  storage,
  identity,
  stageCount,
  keys,
  migrations = {},
} = {}) {
  // 提前经过公开 codec 校验 identity，避免到结算时才暴露配置错误。
  createProfileProgressEnvelope(
    { clearedStars: 0, bestWave: 0 },
    { identity },
  );
  const storageKeys = resolvedKeys(keys);
  const limits = { stageCount };
  normalizeProfileProgress({}, limits);

  function loadLegacy(degradedReason = null) {
    const progressRead = read(storage, storageKeys.legacyProgressKey);
    const bestRead = read(storage, storageKeys.legacyBestWaveKey);
    const readFailed = !progressRead.ok || !bestRead.ok;
    const hasLegacy = progressRead.value !== null || bestRead.value !== null;
    return {
      profile: normalizeProfileProgress({
        clearedStars: progressRead.value,
        bestWave: bestRead.value,
      }, limits),
      source: hasLegacy ? 'legacy' : 'default',
      degraded: Boolean(degradedReason) || readFailed,
      reason: degradedReason ?? (readFailed ? 'storage-read-failed' : null),
      envelope: null,
      migrated: false,
    };
  }

  function loadProfileProgress() {
    const envelopeRead = read(storage, storageKeys.profileKey);
    if (!envelopeRead.ok) return loadLegacy(envelopeRead.reason);
    if (envelopeRead.value === null) return loadLegacy();
    const decoded = decodeSaveEnvelope(envelopeRead.value, {
      expectedKind: SAVE_KINDS.PROFILE_PROGRESS,
      expectedGameId: identity.gameId,
      migrations,
    });
    if (!decoded.ok) return loadLegacy(decoded.reason);
    return {
      profile: normalizeProfileProgress(decoded.envelope.payload, limits),
      source: 'envelope',
      degraded: false,
      reason: null,
      envelope: decoded.envelope,
      migrated: decoded.migrated,
    };
  }

  function settleMatchResult(result) {
    const loaded = loadProfileProgress();
    const profile = progressAfterMatch(loaded.profile, result, limits);
    const envelope = createProfileProgressEnvelope(profile, {
      identity,
      revision: (loaded.envelope?.revision ?? 0) + 1,
    });
    // KeyValueStorage 无事务能力，所以三个写入全部尝试；任一失败向上层显式降级。
    const results = [
      write(storage, storageKeys.profileKey, encodeSaveEnvelope(envelope)),
      write(storage, storageKeys.legacyProgressKey, String(profile.clearedStars)),
      write(storage, storageKeys.legacyBestWaveKey, String(profile.bestWave)),
    ];
    const persisted = results.every(Boolean) && storage?.persistent !== false;
    return {
      profile,
      envelope,
      persisted,
      degraded: !persisted,
      reason: persisted ? null : 'storage-write-failed',
    };
  }

  function clearProgress() {
    const results = unique(Object.values(storageKeys)).map((key) => remove(storage, key));
    return results.every(Boolean) && storage?.persistent !== false;
  }

  return Object.freeze({
    keys: storageKeys,
    loadProfileProgress,
    settleMatchResult,
    clearProgress,
  });
}
