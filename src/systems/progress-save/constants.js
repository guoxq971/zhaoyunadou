export const PROGRESS_SAVE_API_VERSION = '1.0.0';
export const SAVE_ENVELOPE_SCHEMA_VERSION = '1.0.0';

export const SAVE_KINDS = Object.freeze({
  PROFILE_PROGRESS: 'profile-progress',
  MATCH_SNAPSHOT: 'match-snapshot',
  REPLAY: 'replay',
});

// 键本身不带版本；后续迁移由 SaveEnvelope.schemaVersion 承担。
export const DEFAULT_PROFILE_STORAGE_KEY = 'zyad_profile_progress';
export const LEGACY_PROGRESS_STORAGE_KEY = 'zyad_cleared_stars';
export const LEGACY_BEST_WAVE_STORAGE_KEY = 'zyad_best';

export const DEFAULT_PROGRESS_STORAGE_KEYS = Object.freeze({
  profileKey: DEFAULT_PROFILE_STORAGE_KEY,
  legacyProgressKey: LEGACY_PROGRESS_STORAGE_KEY,
  legacyBestWaveKey: LEGACY_BEST_WAVE_STORAGE_KEY,
});
