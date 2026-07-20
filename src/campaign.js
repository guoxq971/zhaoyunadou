import { CONFIG } from './config.js';
import { gamePackFor } from './engine-core/public.js';
import { applySettledProfileProgress } from './systems/progress-save/index.js';

export const CAMPAIGN_STORAGE_KEY = CONFIG.campaign.storageKey;
export const BEST_WAVE_STORAGE_KEY = 'zyad_best';
export const PROGRESS_STORAGE_KEYS = [CAMPAIGN_STORAGE_KEY, BEST_WAVE_STORAGE_KEY];

const configFrom = (value) => value?.config ?? gamePackFor(value)?.config ?? CONFIG;

export function normalizeClearedStars(value, gamePack) {
  const config = configFrom(gamePack);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(config.campaign.stages.length, Math.max(0, Math.floor(parsed)));
}

export function normalizeStageIndex(value, gamePack) {
  const config = configFrom(gamePack);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(config.campaign.stages.length - 1, Math.max(0, Math.floor(parsed)));
}

export function loadProgress(storage, gamePack) {
  const key = gamePack?.manifests?.game?.storage?.progressKey ?? CAMPAIGN_STORAGE_KEY;
  try { return normalizeClearedStars(storage?.getItem(key), gamePack); }
  catch { return 0; }
}

export function clearProgress(storage, gamePack) {
  let persisted = storage?.persistent !== false;
  const storageManifest = gamePack?.manifests?.game?.storage;
  const keys = storageManifest
    ? [storageManifest.progressKey, storageManifest.bestWaveKey].filter(Boolean)
    : PROGRESS_STORAGE_KEYS;
  for (const key of keys) {
    try {
      if (storage?.removeItem(key) === false) persisted = false;
    } catch {
      persisted = false;
    }
  }
  return persisted;
}

export function stageIndexForProgress(clearedStars, gamePack) {
  const config = configFrom(gamePack);
  return Math.min(normalizeClearedStars(clearedStars, gamePack), config.campaign.stages.length - 1);
}

export function progressAfterResult(clearedStars, stageIndex, win, gamePack) {
  const config = configFrom(gamePack);
  const current = normalizeClearedStars(clearedStars, gamePack);
  const index = Number(stageIndex);
  const last = config.campaign.stages.length - 1;
  if (!win || !Number.isInteger(index) || index < 0 || index > last) return current;

  // 只允许结算已经解锁的关卡，避免坏状态跨关写进度。
  const highestUnlocked = Math.min(current, last);
  if (index > highestUnlocked) return current;
  return Math.max(current, index + 1);
}

export function settleResult(state, storage) {
  const gamePack = gamePackFor(state);
  const storageKey = gamePack?.manifests?.game?.storage?.progressKey ?? CAMPAIGN_STORAGE_KEY;
  if (state.saved) return normalizeClearedStars(state.clearedStars, gamePack);
  if (!state.over) return normalizeClearedStars(state.clearedStars, gamePack);

  const stored = loadProgress(storage, gamePack);
  const next = progressAfterResult(stored, state.stageIndex, state.win, gamePack);
  let savedPersistently = true;
  if (next !== stored) {
    try { savedPersistently = storage.setItem(storageKey, String(next)) !== false; }
    catch { savedPersistently = false; }
  }
  applySettledProfileProgress(state, {
    profile: { clearedStars: next },
    degraded: !savedPersistently || storage?.persistent === false,
  });
  return next;
}

export function resultAction(state) {
  const gamePack = gamePackFor(state);
  const config = configFrom(state);
  const stageIndex = normalizeStageIndex(state.stageIndex, gamePack);
  const last = config.campaign.stages.length - 1;
  const cleared = normalizeClearedStars(state.clearedStars, gamePack);
  const acceptedWin = state.over && state.win && state.saved && cleared > stageIndex;
  if (!acceptedWin) return { kind: 'replay', stageIndex };
  if (stageIndex < last) return { kind: 'next', stageIndex: stageIndex + 1 };
  return { kind: 'complete', stageIndex: last };
}
