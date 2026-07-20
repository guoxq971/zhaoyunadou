import { immutableSnapshot } from '../../engine-core/events.js';

const numericOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function snapshotResources(state) {
  const benchCapacity = Array.isArray(state?.bench) ? state.bench.length : null;
  const benchUsed = Array.isArray(state?.bench)
    ? state.bench.reduce((count, item) => count + Number(Boolean(item)), 0)
    : null;
  return {
    mantou: numericOrNull(state?.mantou),
    lives: numericOrNull(state?.lives),
    shovels: numericOrNull(state?.shovels),
    brushes: numericOrNull(state?.brushes),
    benchUsed,
    benchCapacity,
  };
}

// ruleset 决定哪些状态字段进入分析快照，engine-core 不认识馒头、铲子等玩法概念。
export function snapshotMergeDefenseState(state) {
  const stageIndex = Number.isInteger(state?.stageIndex) ? state.stageIndex : null;
  const stageId = typeof state?.stage?.id === 'string' ? state.stage.id : null;
  return immutableSnapshot({
    screen: state?.title ? 'title' : state?.over ? 'result' : 'battle',
    stage: stageId ?? (stageIndex === null ? null : stageIndex + 1),
    stageId,
    stageIndex,
    wave: numericOrNull(state?.wave),
    battleTime: numericOrNull(state?.time),
    phase: typeof state?.phase === 'string' ? state.phase : null,
    over: Boolean(state?.over),
    win: Boolean(state?.win),
    resources: snapshotResources(state),
    stats: state?.stats && typeof state.stats === 'object' ? { ...state.stats } : {},
  });
}
