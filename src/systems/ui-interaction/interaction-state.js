const EMPTY_INTERACTION = Object.freeze({
  item: null,
  x: 0,
  y: 0,
  mode: null,
  source: null,
  expectedSource: null,
  from: null,
  index: null,
  r: null,
  c: null,
  hover: null,
  lastCommand: null,
  lastRecruitBatch: null,
});

export function resetInteractionState(interaction) {
  if (!interaction || typeof interaction !== 'object') {
    throw new TypeError('[ui-interaction] interaction state is required');
  }
  Object.assign(interaction, EMPTY_INTERACTION);
  return interaction;
}

export function createInteractionState(initial = {}) {
  const interaction = {};
  resetInteractionState(interaction);
  Object.assign(interaction, initial);
  return interaction;
}

// 命令结果摘要属于本地交互反馈，不进入玩法状态、存档或 command log。
export function recordCommandResult(interaction, command, result, stateTime = 0) {
  if (!interaction || typeof interaction !== 'object') {
    throw new TypeError('[ui-interaction] interaction state is required');
  }
  const time = Number.isFinite(stateTime) ? stateTime : 0;
  interaction.lastCommand = {
    type: String(command?.type ?? ''),
    ok: Boolean(result?.ok),
    reason: result?.reason ?? 'none',
    action: result?.action ?? '',
    sequence: command?.sequence,
    until: time + 2.2,
  };
  if (command?.type === 'battle.batch_recruit') {
    interaction.lastRecruitBatch = {
      filledCount: result?.filledCount ?? 0,
      totalCost: result?.totalCost ?? 0,
      stopReason: result?.stopReason ?? result?.reason,
      until: time + 2.8,
    };
  }
  return interaction.lastCommand;
}

export function setPointerFeedback(interaction, { x, y, hover } = {}) {
  if (Number.isFinite(x)) interaction.x = x;
  if (Number.isFinite(y)) interaction.y = y;
  if (hover !== undefined) interaction.hover = hover;
  return interaction;
}

export function setInteractionMode(interaction, mode) {
  interaction.mode = mode ?? null;
  return interaction.mode;
}
