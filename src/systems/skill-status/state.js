import { cloneSerializableData, getStateSlice } from '../../engine-core/public.js';

const defaults = () => ({
  heroes: [],
  buff: null,
  lastHeroUnlocked: null,
  lastHeroCast: null,
  dragons: [],
  statuses: [],
  nextEntitySequence: 0,
  stats: { heroCasts: 0, heroUnlocks: 0 },
});

function normalizeSkillStatusState(target) {
  const base = defaults();
  for (const [key, value] of Object.entries(base)) {
    if (target[key] === undefined) target[key] = cloneSerializableData(value);
  }
  if (!Array.isArray(target.heroes)) throw new TypeError('[skill-status] heroes must be an array');
  if (!Array.isArray(target.dragons)) throw new TypeError('[skill-status] dragons must be an array');
  if (!Array.isArray(target.statuses)) throw new TypeError('[skill-status] statuses must be an array');
  if (!Number.isInteger(target.nextEntitySequence) || target.nextEntitySequence < 0) {
    throw new TypeError('[skill-status] nextEntitySequence must be a non-negative integer');
  }
  return target;
}

export function createSkillStatusState(initial = {}) {
  if (!initial || typeof initial !== 'object' || Array.isArray(initial)) {
    throw new TypeError('[skill-status] initial state must be an object');
  }
  return normalizeSkillStatusState({ ...defaults(), ...cloneSerializableData(initial) });
}

// 集成层把现有命名切片交给本系统；这里不会读取或写入其他系统切片。
export function skillStatusStateFor(state) {
  return normalizeSkillStatusState(getStateSlice(state, 'skillStatus'));
}

export function nextSkillEntityId(skillState, prefix) {
  skillState.nextEntitySequence++;
  return `${prefix}-${skillState.nextEntitySequence}`;
}

export function snapshotSkillStatus(skillState) {
  return cloneSerializableData(normalizeSkillStatusState(skillState));
}
