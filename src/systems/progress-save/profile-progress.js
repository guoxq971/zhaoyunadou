const normalizeCounter = (value, maximum = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(maximum, Math.max(0, Math.floor(parsed)));
};

function assertStageCount(stageCount) {
  if (!Number.isInteger(stageCount) || stageCount < 1) {
    throw new TypeError('[progress-save] stageCount must be a positive integer');
  }
  return stageCount;
}

export function normalizeProfileProgress(value = {}, { stageCount } = {}) {
  const count = assertStageCount(stageCount);
  return Object.freeze({
    clearedStars: normalizeCounter(value?.clearedStars, count),
    bestWave: normalizeCounter(value?.bestWave),
  });
}

export function progressAfterMatch(profile, result, { stageCount } = {}) {
  const count = assertStageCount(stageCount);
  const current = normalizeProfileProgress(profile, { stageCount: count });
  const stageIndex = Number(result?.stageIndex);
  let clearedStars = current.clearedStars;
  if (
    result?.win === true
    && Number.isInteger(stageIndex)
    && stageIndex >= 0
    && stageIndex < count
    && stageIndex <= Math.min(current.clearedStars, count - 1)
  ) {
    clearedStars = Math.max(clearedStars, stageIndex + 1);
  }
  const reachedWave = normalizeCounter(result?.bestWave);
  return Object.freeze({
    clearedStars,
    bestWave: Math.max(current.bestWave, reachedWave),
  });
}
