import {
  cloneSerializableData,
  getStateSlice,
  hasStateSlices,
} from '../../engine-core/public.js';

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

export const createSkillStatusRuntimeStateSlice = () => ({
  dragons: [],
  statuses: [],
  nextEntitySequence: 0,
});

export const createSkillStatusStateSlice = () => createSkillStatusState();

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
  return normalizeSkillStatusState(hasStateSlices(state) ? getStateSlice(state, 'skillStatus') : state);
}

// 英雄阵列、最近解锁和统计均归 Skill/Status 切片，Economy 只提交完整描述。
export function registerUnlockedHero(state, descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError('[skill-status] hero descriptor is required');
  }
  if (typeof descriptor.key !== 'string' || descriptor.key.length === 0) {
    throw new TypeError('[skill-status] hero key is required');
  }
  const skillState = skillStatusStateFor(state);
  const hero = { ...descriptor };
  skillState.heroes.push(hero);
  skillState.lastHeroUnlocked = hero.key;
  skillState.stats.heroUnlocks = (skillState.stats.heroUnlocks ?? 0) + 1;
  return hero;
}

export function statusRemainingForState(state, targetId, statusId, time) {
  const now = Number(time);
  if (!Number.isFinite(now)) throw new TypeError('[skill-status] status time must be finite');
  const status = skillStatusStateFor(state).statuses.find((entry) => (
    entry.targetId === targetId && entry.statusId === statusId
  ));
  if (!status) return 0;
  return Math.max(0, Number.isFinite(status.remaining)
    ? status.remaining
    : status.expiresAt - now);
}

// 候选基座按敌人移动 tick 先检查、再扣减眩晕；状态系统拥有剩余时长，Combat 只消费窄口结果。
export function consumeStatusTickForState(
  state,
  targetId,
  statusId,
  dt,
  timeBeforeTick = 0,
) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError('[skill-status] status tick must be non-negative');
  }
  if (!Number.isFinite(timeBeforeTick)) {
    throw new TypeError('[skill-status] status time must be finite');
  }
  const status = skillStatusStateFor(state).statuses.find((entry) => (
    entry.targetId === targetId && entry.statusId === statusId
  ));
  if (!status) return false;
  if (!Number.isFinite(status.remaining)) {
    status.remaining = Math.max(0, status.expiresAt - timeBeforeTick);
  }
  if (status.remaining <= 0) return false;
  status.remaining -= dt;
  return true;
}

export function nextSkillEntityId(skillState, prefix) {
  skillState.nextEntitySequence++;
  return `${prefix}-${skillState.nextEntitySequence}`;
}

export function snapshotSkillStatus(skillState) {
  return cloneSerializableData(normalizeSkillStatusState(skillState));
}
