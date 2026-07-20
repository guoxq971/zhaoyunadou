function readonlySnapshot(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value ?? null;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Set) {
    const copy = [];
    seen.set(value, copy);
    copy.push(...[...value].map((entry) => readonlySnapshot(entry, seen)));
    return Object.freeze(copy);
  }
  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    copy.push(...value.map((entry) => readonlySnapshot(entry, seen)));
    return Object.freeze(copy);
  }
  const copy = {};
  seen.set(value, copy);
  // Piece 的稳定身份字段为 non-enumerable；ViewModel 仍需保留它们用于表现反馈与调试。
  for (const key of Object.getOwnPropertyNames(value)) {
    copy[key] = readonlySnapshot(value[key], seen);
  }
  return Object.freeze(copy);
}

function interactionSnapshot(interaction = {}) {
  return Object.freeze({
    item: readonlySnapshot(interaction.item),
    mode: interaction.mode ?? null,
    source: readonlySnapshot(interaction.source),
    expectedSource: interaction.expectedSource ?? null,
    x: Number(interaction.x) || 0,
    y: Number(interaction.y) || 0,
    from: interaction.from ?? null,
    index: interaction.index ?? null,
    r: interaction.r ?? null,
    c: interaction.c ?? null,
    hover: readonlySnapshot(interaction.hover),
    lastCommand: readonlySnapshot(interaction.lastCommand),
    lastRecruitBatch: readonlySnapshot(interaction.lastRecruitBatch),
  });
}

const frozenPreview = (preview) => Object.freeze({
  ok: Boolean(preview?.ok),
  action: preview?.action ?? null,
  reason: preview?.reason ?? (preview?.ok ? 'none' : 'invalid-target'),
});

function interactionTargets(state, interaction, previewTransfer) {
  const grid = state.grid.map((row, r) => Object.freeze(row.map((cell, c) => {
    if (interaction.mode === 'brush') {
      return frozenPreview(['troop', 'frag'].includes(cell.unit?.kind)
        ? { ok: true, action: 'rewrite' }
        : { ok: false, reason: 'invalid-brush-target' });
    }
    if (interaction.mode === 'shovel' || interaction.item?.kind === 'shovel') {
      return frozenPreview(cell.type === 'locked'
        ? { ok: true, action: 'open' }
        : { ok: false, reason: 'target-not-locked' });
    }
    if (!interaction.item || typeof previewTransfer !== 'function') return null;
    return frozenPreview(previewTransfer({
      source: interaction.source,
      target: { zone: 'grid', r, c },
      expectedSource: interaction.expectedSource,
    }));
  })));
  const bench = state.bench.map((piece, index) => {
    if (!interaction.item) return null;
    if (interaction.item.kind === 'shovel') {
      return frozenPreview(!piece && interaction.source?.index !== index
        ? { ok: true, action: 'move' }
        : { ok: false, reason: piece ? 'target-not-empty' : 'same-location' });
    }
    if (typeof previewTransfer !== 'function') return null;
    return frozenPreview(previewTransfer({
      source: interaction.source,
      target: { zone: 'bench', index },
      expectedSource: interaction.expectedSource,
    }));
  });
  return Object.freeze({ grid: Object.freeze(grid), bench: Object.freeze(bench) });
}

// 输入映射只消费这份只读摘要，不持有可写玩法状态引用。
export function createGameViewModel(state, interaction, {
  stageCount = 0,
  benchSize = state?.bench?.length ?? 0,
  highestUnlockedStageIndex = Math.min(
    Math.max(0, Number(state?.clearedStars) || 0),
    Math.max(0, Number(stageCount) - 1),
  ),
  previewTransfer = null,
  recruitPreview = null,
  enemyPosition = null,
  enemyStatus = null,
  presentationFeedback = null,
} = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('[ui-view-model] state is required');
  const screen = state.title ? 'title' : state.over ? 'result' : 'battle';
  const interactionView = interactionSnapshot(interaction);
  const enemyViews = Object.freeze((state.enemies ?? []).map((enemy) => Object.freeze({
    ...readonlySnapshot(enemy),
    bob: presentationFeedback?.enemyBobPhases?.[enemy.enemyId] ?? 0,
    hitFlash: presentationFeedback?.enemyHitFlashes?.[enemy.enemyId] ?? 0,
    stun: typeof enemyStatus === 'function' ? enemyStatus(enemy, 'stun') : 0,
    position: readonlySnapshot(typeof enemyPosition === 'function'
      ? enemyPosition(enemy)
      : { x: 0, y: 0 }),
  })));
  return Object.freeze({
    screen,
    title: Boolean(state.title),
    over: Boolean(state.over),
    win: Boolean(state.win),
    time: Number(state.time) || 0,
    speed: Number(state.speed) || 0,
    phase: state.phase ?? null,
    stageIndex: Number.isInteger(state.stageIndex) ? state.stageIndex : 0,
    stageCount: Math.max(0, Number(stageCount) || 0),
    highestUnlockedStageIndex: Math.max(0, Number(highestUnlockedStageIndex) || 0),
    benchSize: Math.max(0, Number(benchSize) || 0),
    interaction: interactionView,
    interactionTargets: interactionTargets(state, interactionView, previewTransfer),
    recruitPreview: readonlySnapshot(recruitPreview),
    // ViewModel 是表现帧快照；不把可写玩法实体泄漏给 Renderer 或输入映射。
    bench: readonlySnapshot(state.bench ?? []),
    brushes: state.brushes,
    clearedStars: state.clearedStars,
    effects: readonlySnapshot(state.effects ?? []),
    enemies: enemyViews,
    enemyViews,
    grid: readonlySnapshot(state.grid ?? []),
    pieceHitFlashes: readonlySnapshot(presentationFeedback?.pieceHitFlashes ?? {}),
    heroes: readonlySnapshot(state.heroes ?? []),
    lives: state.lives,
    luoyang: readonlySnapshot(state.luoyang),
    mantou: state.mantou,
    path: readonlySnapshot(state.path ?? []),
    paths: readonlySnapshot(state.paths ?? []),
    phaseT: state.phaseT,
    projectiles: readonlySnapshot(state.projectiles ?? []),
    recruitCount: state.recruitCount,
    resetConfirmUntil: state.resetConfirmUntil,
    resetResult: state.resetResult,
    saveWarning: state.saveWarning,
    stage: readonlySnapshot(state.stage),
    stats: readonlySnapshot(state.stats ?? {}),
    wave: state.wave,
  });
}
