import { CONFIG } from './config.js';

export const CAMPAIGN_STORAGE_KEY = CONFIG.campaign.storageKey;
export const BEST_WAVE_STORAGE_KEY = 'zyad_best';
export const PROGRESS_STORAGE_KEYS = [CAMPAIGN_STORAGE_KEY, BEST_WAVE_STORAGE_KEY];

export function normalizeClearedStars(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(CONFIG.campaign.stages.length, Math.max(0, Math.floor(parsed)));
}

export function normalizeStageIndex(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(CONFIG.campaign.stages.length - 1, Math.max(0, Math.floor(parsed)));
}

export function loadProgress(storage) {
  try { return normalizeClearedStars(storage?.getItem(CAMPAIGN_STORAGE_KEY)); }
  catch { return 0; }
}

export function clearProgress(storage) {
  let persisted = storage?.persistent !== false;
  for (const key of PROGRESS_STORAGE_KEYS) {
    try {
      if (storage?.removeItem(key) === false) persisted = false;
    } catch {
      persisted = false;
    }
  }
  return persisted;
}

export function stageIndexForProgress(clearedStars) {
  return Math.min(normalizeClearedStars(clearedStars), CONFIG.campaign.stages.length - 1);
}

export function progressAfterResult(clearedStars, stageIndex, win) {
  const current = normalizeClearedStars(clearedStars);
  const index = Number(stageIndex);
  const last = CONFIG.campaign.stages.length - 1;
  if (!win || !Number.isInteger(index) || index < 0 || index > last) return current;

  // 只允许结算已经解锁的关卡，避免坏状态跨关写进度。
  const highestUnlocked = Math.min(current, last);
  if (index > highestUnlocked) return current;
  return Math.max(current, index + 1);
}

export function settleResult(state, storage) {
  if (state.saved) return normalizeClearedStars(state.clearedStars);
  if (!state.over) return normalizeClearedStars(state.clearedStars);

  const stored = loadProgress(storage);
  const next = progressAfterResult(stored, state.stageIndex, state.win);
  let savedPersistently = true;
  if (next !== stored) {
    try { savedPersistently = storage.setItem(CAMPAIGN_STORAGE_KEY, String(next)) !== false; }
    catch { savedPersistently = false; }
  }
  state.clearedStars = next;
  state.saveWarning = !savedPersistently || storage?.persistent === false;
  state.saved = true;
  return next;
}

export function resultAction(state) {
  const stageIndex = normalizeStageIndex(state.stageIndex);
  const last = CONFIG.campaign.stages.length - 1;
  const cleared = normalizeClearedStars(state.clearedStars);
  const acceptedWin = state.over && state.win && state.saved && cleared > stageIndex;
  if (!acceptedWin) return { kind: 'replay', stageIndex };
  if (stageIndex < last) return { kind: 'next', stageIndex: stageIndex + 1 };
  return { kind: 'complete', stageIndex: last };
}
