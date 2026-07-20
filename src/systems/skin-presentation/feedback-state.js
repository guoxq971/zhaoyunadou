import {
  getStateSlice,
  hasStateSlices,
} from '../../engine-core/public.js';

const createFeedback = () => ({
  enemyBobPhases: {},
  enemyHitFlashes: {},
  pieceHitFlashes: {},
});

export const createPresentationStateSlice = () => ({
  effects: [],
  feedback: createFeedback(),
});

function feedbackFor(state) {
  const presentation = hasStateSlices(state) ? getStateSlice(state, 'presentation') : state;
  presentation.feedback ??= createFeedback();
  presentation.feedback.enemyBobPhases ??= {};
  presentation.feedback.enemyHitFlashes ??= {};
  presentation.feedback.pieceHitFlashes ??= {};
  return presentation.feedback;
}

function mark(collection, id, duration) {
  if (typeof id !== 'string' || id.length === 0) return false;
  const next = Number(duration);
  if (!Number.isFinite(next) || next <= 0) return false;
  collection[id] = Math.max(collection[id] ?? 0, next);
  return true;
}

export function markEnemyHitFeedback(state, enemyId, duration = 0.12) {
  return mark(feedbackFor(state).enemyHitFlashes, enemyId, duration);
}

export function markPieceHitFeedback(state, pieceId, duration = 0.15) {
  return mark(feedbackFor(state).pieceHitFlashes, pieceId, duration);
}

export function setEnemyBobPhase(state, enemyId, phase) {
  const next = Number(phase);
  if (typeof enemyId !== 'string' || enemyId.length === 0 || !Number.isFinite(next)) return false;
  feedbackFor(state).enemyBobPhases[enemyId] = next;
  return true;
}

export function enemyBobPhase(state, enemy) {
  if (Object.hasOwn(enemy ?? {}, 'bob')) return Number(enemy.bob) || 0;
  return feedbackFor(state).enemyBobPhases[enemy?.enemyId] ?? 0;
}

function advanceCollection(collection, dt) {
  for (const [id, remaining] of Object.entries(collection)) {
    const next = Math.max(0, Number(remaining) - dt);
    if (next <= 0) delete collection[id];
    else collection[id] = Number(next.toFixed(6));
  }
}

function validatedDelta(dt) {
  const delta = Number(dt);
  if (!Number.isFinite(delta) || delta < 0) {
    throw new RangeError('[skin-presentation] feedback delta must be non-negative');
  }
  return delta;
}

export function advanceEnemyPresentationFeedback(
  state,
  dt,
  activeEnemyIds = null,
  movingEnemyIds = activeEnemyIds,
) {
  const delta = validatedDelta(dt);
  const feedback = feedbackFor(state);
  if (activeEnemyIds !== null) {
    const active = new Set(activeEnemyIds);
    for (const collection of [feedback.enemyBobPhases, feedback.enemyHitFlashes]) {
      for (const id of Object.keys(collection)) if (!active.has(id)) delete collection[id];
    }
  }
  const moving = movingEnemyIds === null ? null : new Set(movingEnemyIds);
  for (const id of Object.keys(feedback.enemyBobPhases)) {
    if (moving && !moving.has(id)) continue;
    feedback.enemyBobPhases[id] = Number((feedback.enemyBobPhases[id] + delta * 8).toFixed(6));
  }
  advanceCollection(feedback.enemyHitFlashes, delta);
  return feedback;
}

export function advancePiecePresentationFeedback(state, dt) {
  const delta = validatedDelta(dt);
  const feedback = feedbackFor(state);
  advanceCollection(feedback.pieceHitFlashes, delta);
  return feedback;
}

// 兼容专项测试与旧调用；生产循环使用敌人/弈子的独立时序函数。
export function advancePresentationFeedback(state, dt) {
  advanceEnemyPresentationFeedback(state, dt);
  return advancePiecePresentationFeedback(state, dt);
}

export function presentationFeedbackSnapshot(state) {
  const feedback = feedbackFor(state);
  return Object.freeze({
    enemyBobPhases: Object.freeze({ ...feedback.enemyBobPhases }),
    enemyHitFlashes: Object.freeze({ ...feedback.enemyHitFlashes }),
    pieceHitFlashes: Object.freeze({ ...feedback.pieceHitFlashes }),
  });
}
