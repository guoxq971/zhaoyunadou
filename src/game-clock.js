import { getStateSlice, hasStateSlices } from './engine-core/state-slices.js';

function simulationClockState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('[simulation-clock] state is required');
  }
  return hasStateSlices(state) ? getStateSlice(state, 'foundation') : state;
}

function normalizedResumeSpeed(clockState) {
  return Number.isFinite(clockState.resumeSpeed) && clockState.resumeSpeed > 0
    ? clockState.resumeSpeed
    : Number.isFinite(clockState.speed) && clockState.speed > 0
      ? clockState.speed
      : 1;
}

// Foundation 独占模拟速度与暂停恢复值；MatchMode 只通过该窄 API 提交变更。
export function setSimulationSpeed(state, speed) {
  const nextSpeed = Number(speed);
  if (!Number.isFinite(nextSpeed) || nextSpeed < 0) {
    throw new RangeError('[simulation-clock] speed must be a non-negative finite number');
  }
  const clockState = simulationClockState(state);
  if (nextSpeed > 0) clockState.resumeSpeed = nextSpeed;
  else clockState.resumeSpeed = normalizedResumeSpeed(clockState);
  clockState.speed = nextSpeed;
  return Object.freeze({ speed: clockState.speed, resumeSpeed: clockState.resumeSpeed });
}

export function setSimulationPaused(state, paused) {
  const clockState = simulationClockState(state);
  if (Boolean(paused)) {
    if (Number.isFinite(clockState.speed) && clockState.speed > 0) {
      clockState.resumeSpeed = clockState.speed;
    } else clockState.resumeSpeed = normalizedResumeSpeed(clockState);
    clockState.speed = 0;
  } else {
    clockState.resumeSpeed = normalizedResumeSpeed(clockState);
    clockState.speed = clockState.resumeSpeed;
  }
  return Object.freeze({
    paused: clockState.speed === 0,
    speed: clockState.speed,
    resumeSpeed: clockState.resumeSpeed,
  });
}

export function createGameClock(now) {
  if (typeof now !== 'function') throw new TypeError('monotonic now() is required');
  let last = now();
  return {
    reset() { last = now(); },
    next(speed = 1, hidden = false) {
      const current = now();
      const elapsed = Math.max(0, (current - last) / 1000);
      last = current;
      if (hidden) return 0;
      return Math.min(elapsed, 0.05) * Math.max(0, speed);
    },
  };
}
