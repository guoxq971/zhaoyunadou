import {
  getStateSlice,
  hasStateSlices,
} from '../../engine-core/public.js';
import { normalizeProfileProgress } from './profile-progress.js';

export function createProgressStateSlice({ clearedStars = 0, stageCount } = {}) {
  const profile = normalizeProfileProgress({ clearedStars }, { stageCount });
  return {
    clearedStars: profile.clearedStars,
    saved: undefined,
    saveWarning: undefined,
  };
}

function progressStateFor(state) {
  if (!state || typeof state !== 'object') throw new TypeError('[progress-save] state is required');
  return hasStateSlices(state) ? getStateSlice(state, 'progress') : state;
}

// App Shell 只交付 repository 结果，Progress 独占永久进度切片的投影。
export function applyLoadedProfileProgress(state, loaded) {
  if (!loaded?.profile) throw new TypeError('[progress-save] loaded profile is required');
  const progress = progressStateFor(state);
  progress.clearedStars = loaded.profile.clearedStars;
  progress.saveWarning = Boolean(loaded.degraded);
  return {
    clearedStars: progress.clearedStars,
    saveWarning: progress.saveWarning,
  };
}

export function applySettledProfileProgress(state, settled) {
  if (!settled?.profile) throw new TypeError('[progress-save] settled profile is required');
  const progress = progressStateFor(state);
  progress.clearedStars = settled.profile.clearedStars;
  progress.saveWarning = Boolean(settled.degraded);
  progress.saved = true;
  return {
    clearedStars: progress.clearedStars,
    saveWarning: progress.saveWarning,
    saved: progress.saved,
  };
}
