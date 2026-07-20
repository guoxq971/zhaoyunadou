function readonlyRecord(value) {
  return value && typeof value === 'object' ? Object.freeze({ ...value }) : value ?? null;
}

function interactionSnapshot(interaction = {}) {
  return Object.freeze({
    item: readonlyRecord(interaction.item),
    mode: interaction.mode ?? null,
    source: readonlyRecord(interaction.source),
    expectedSource: interaction.expectedSource ?? null,
    x: Number(interaction.x) || 0,
    y: Number(interaction.y) || 0,
    from: interaction.from ?? null,
    index: interaction.index ?? null,
    r: interaction.r ?? null,
    c: interaction.c ?? null,
    hover: readonlyRecord(interaction.hover),
    lastCommand: readonlyRecord(interaction.lastCommand),
    lastRecruitBatch: readonlyRecord(interaction.lastRecruitBatch),
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
  previewTransfer = null,
  recruitPreview = null,
  enemyPosition = null,
} = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('[ui-view-model] state is required');
  const screen = state.title ? 'title' : state.over ? 'result' : 'battle';
  const interactionView = interactionSnapshot(interaction);
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
    benchSize: Math.max(0, Number(benchSize) || 0),
    interaction: interactionView,
    interactionTargets: interactionTargets(state, interactionView, previewTransfer),
    recruitPreview: recruitPreview ? Object.freeze({ ...recruitPreview }) : null,
    // Renderer 仅读的浅视图；保留引用避免每帧深拷贝棋盘。
    bench: state.bench,
    brushes: state.brushes,
    clearedStars: state.clearedStars,
    effects: state.effects,
    enemies: state.enemies,
    enemyViews: Object.freeze((state.enemies ?? []).map((enemy) => Object.freeze({
      ...enemy,
      position: Object.freeze(typeof enemyPosition === 'function'
        ? enemyPosition(enemy)
        : { x: 0, y: 0 }),
    }))),
    grid: state.grid,
    heroes: state.heroes,
    lives: state.lives,
    luoyang: state.luoyang,
    mantou: state.mantou,
    path: state.path,
    paths: state.paths,
    phaseT: state.phaseT,
    projectiles: state.projectiles,
    recruitCount: state.recruitCount,
    resetConfirmUntil: state.resetConfirmUntil,
    resetResult: state.resetResult,
    saveWarning: state.saveWarning,
    stage: state.stage,
    stats: state.stats,
    wave: state.wave,
  });
}
