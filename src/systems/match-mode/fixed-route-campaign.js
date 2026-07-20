export const MATCH_MODE_API_VERSION = '1.0.0';
import {
  advanceSimulationTime,
  setSimulationTime,
} from '../../engine-core/public.js';
export const FIXED_ROUTE_CAMPAIGN_MODE_ID = 'fixed-route-campaign';
export const LOCAL_PLAYER_ACTOR = Object.freeze({ actorId: 'local-player', side: 'player' });

// 固定路线战役授权当前玩家可提交的全部命令；具体处理仍归各独立系统。
export const FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES = Object.freeze([
  'campaign.select_stage',
  'campaign.start_stage',
  'campaign.reset_progress',
  'battle.batch_recruit',
  'battle.start_wave',
  'battle.set_paused',
  'battle.set_speed',
  'interaction.drag_begin',
  'interaction.drag_cancel',
  'unit.drop',
  'item.relocate',
  'item.select_mode',
  'item.use',
  'result.resolve',
  'battle.retry',
  'session.quit',
]);

const authorizedCommandTypes = new Set(FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES);
const noReset = () => {};
const noClear = () => true;
const noPublish = () => null;
const noTick = () => 0;

function stageCountFor(gamePack) {
  const count = gamePack?.config?.campaign?.stages?.length;
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError('[match-mode] a Game Pack with campaign stages is required');
  }
  return count;
}

function normalizeProgress(value, stageCount) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(stageCount, Math.max(0, Math.floor(parsed)));
}

function normalizeStageIndex(value, stageCount) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(stageCount - 1, Math.max(0, Math.floor(parsed)));
}

export function createFixedRouteMatchStateSlice({ stageIndex = 0, gamePack } = {}) {
  const stageCount = stageCountFor(gamePack);
  const selectedIndex = normalizeStageIndex(stageIndex, stageCount);
  return {
    title: true,
    resetConfirmUntil: 0,
    resetResult: 'idle',
    stageIndex: selectedIndex,
    stage: gamePack.config.campaign.stages[selectedIndex],
    over: false,
    win: false,
  };
}

function tickFrom(value) {
  const tick = Number(value);
  return Number.isInteger(tick) && tick >= 0 ? tick : 0;
}

function resultAction(state, stageCount) {
  const stageIndex = normalizeStageIndex(state.stageIndex, stageCount);
  const clearedStars = normalizeProgress(state.clearedStars, stageCount);
  const acceptedWin = state.over && state.win && state.saved && clearedStars > stageIndex;
  if (!acceptedWin) return Object.freeze({ kind: 'replay', stageIndex });
  if (stageIndex < stageCount - 1) {
    return Object.freeze({ kind: 'next', stageIndex: stageIndex + 1 });
  }
  return Object.freeze({ kind: 'complete', stageIndex });
}

export function fixedRouteResultAction(state, gamePack) {
  return resultAction(state, stageCountFor(gamePack));
}

export function authorizeFixedRouteCampaignCommand(command) {
  if (command?.actorId !== LOCAL_PLAYER_ACTOR.actorId) {
    return { ok: false, reason: 'actor-not-registered' };
  }
  if (command.side !== LOCAL_PLAYER_ACTOR.side) {
    return { ok: false, reason: 'actor-side-mismatch' };
  }
  if (!authorizedCommandTypes.has(command.type)) {
    return { ok: false, reason: 'command-not-authorized' };
  }
  return { ok: true, reason: 'none' };
}

function publishMatchEnded(state, event, publishDomainEvent) {
  publishDomainEvent(state, {
    type: 'match.ended',
    source: 'match-controller',
    tick: tickFrom(event.tick),
    payload: {
      result: event.payload?.result ?? null,
      reason: event.payload?.reason ?? 'encounter-completed',
      wave: event.payload?.wave ?? 0,
    },
  });
}

// Match 只消费 Encounter 的最终事实，不参与波次或战斗判定。
export function consumeFixedRouteCampaignDomainEvents(
  state,
  events,
  { publishDomainEvent = noPublish } = {},
) {
  if (!state || typeof state !== 'object') throw new TypeError('[match-mode] state is required');
  if (typeof publishDomainEvent !== 'function') {
    throw new TypeError('[match-mode] publishDomainEvent must be a function');
  }
  let consumed = 0;
  let completed = false;
  let result = null;
  for (const event of events ?? []) {
    if (event?.type !== 'encounter.completed') continue;
    consumed++;
    completed = true;
    result = event.payload?.result ?? null;
    state.over = true;
    state.win = result === 'victory';
    publishMatchEnded(state, event, publishDomainEvent);
  }
  return { consumed, completed, result };
}

export function createFixedRouteCampaignDomainEventHandlers({
  getState,
  publishDomainEvent = noPublish,
} = {}) {
  if (typeof getState !== 'function') throw new TypeError('[match-mode] getState is required');
  if (typeof publishDomainEvent !== 'function') {
    throw new TypeError('[match-mode] publishDomainEvent must be a function');
  }
  return Object.freeze({
    'encounter.completed': (event) => consumeFixedRouteCampaignDomainEvents(
      getState(),
      [event],
      { publishDomainEvent },
    ),
  });
}

export function createFixedRouteCampaignMode({
  initialProgress = 0,
  gamePack,
  createState,
  advanceRules,
  onInteractionReset = noReset,
  clearProgress = noClear,
  publishDomainEvent = noPublish,
  getTick = noTick,
} = {}) {
  const stageCount = stageCountFor(gamePack);
  if (typeof createState !== 'function') throw new TypeError('[match-mode] createState is required');
  if (typeof advanceRules !== 'function') throw new TypeError('[match-mode] advanceRules is required');
  if (typeof onInteractionReset !== 'function') {
    throw new TypeError('[match-mode] onInteractionReset must be a function');
  }
  if (typeof clearProgress !== 'function') throw new TypeError('[match-mode] clearProgress must be a function');
  if (typeof publishDomainEvent !== 'function') {
    throw new TypeError('[match-mode] publishDomainEvent must be a function');
  }
  if (typeof getTick !== 'function') throw new TypeError('[match-mode] getTick must be a function');

  const normalizedInitialProgress = normalizeProgress(initialProgress, stageCount);
  let state = createState(0, normalizedInitialProgress, gamePack);
  if (!state || typeof state !== 'object') throw new TypeError('[match-mode] createState must return state');

  const highestUnlockedStageIndex = () => Math.min(
    normalizeProgress(state.clearedStars, stageCount),
    stageCount - 1,
  );

  function replaceState(stageIndex, clearedStars) {
    const replacement = createState(stageIndex, clearedStars, gamePack);
    if (!replacement || typeof replacement !== 'object') {
      throw new TypeError('[match-mode] createState must return state');
    }
    state = replacement;
    return state;
  }

  function publish(type, payload, tick = getTick()) {
    return publishDomainEvent(state, {
      type,
      source: 'match-controller',
      tick: tickFrom(tick),
      payload,
    });
  }

  function startStage(stageIndex, title = false, reason = 'player-start') {
    const safeStageIndex = Math.min(
      normalizeStageIndex(stageIndex, stageCount),
      highestUnlockedStageIndex(),
    );
    const clearedStars = state.clearedStars;
    replaceState(safeStageIndex, clearedStars);
    state.title = Boolean(title);
    onInteractionReset();
    if (!state.title) {
      publish('match.started', {
        stageIndex: state.stageIndex,
        stageId: state.stage?.id ?? `stage-${state.stageIndex + 1}`,
        reason,
      });
    }
    return state;
  }

  function selectStage(stageIndex) {
    if (!state.title) return false;
    const index = Number(stageIndex);
    if (!Number.isInteger(index) || index < 0 || index > highestUnlockedStageIndex()) return false;
    if (index === state.stageIndex) {
      state.resetConfirmUntil = 0;
      return true;
    }
    const titleTime = state.time;
    replaceState(index, state.clearedStars);
    setSimulationTime(state, titleTime);
    onInteractionReset();
    return true;
  }

  function cancelProgressReset() {
    state.resetConfirmUntil = 0;
  }

  function requestProgressReset() {
    if (!state.title) return 'ignored';
    if (state.resetConfirmUntil <= state.time) {
      state.resetConfirmUntil = state.time + 3;
      return 'confirm';
    }
    const persisted = clearProgress() !== false;
    replaceState(0, 0);
    state.title = true;
    state.resetResult = persisted ? 'cleared' : 'memory-only';
    onInteractionReset();
    return state.resetResult;
  }

  function startCurrentStage() {
    cancelProgressReset();
    startStage(state.stageIndex);
  }

  function restart() {
    publish('match.retry_requested', { stageIndex: state.stageIndex, reason: 'manual-retry' });
    startStage(state.stageIndex, false, 'retry');
  }

  function abandon(reason = 'player-quit') {
    if (state.title) return false;
    publish('match.quit_requested', { stageIndex: state.stageIndex, reason });
    publish('match.ended', {
      result: 'abandoned',
      reason,
      wave: state.wave ?? 0,
    });
    return true;
  }

  function quitToTitle(reason = 'player-quit') {
    if (!abandon(reason)) return false;
    startStage(state.stageIndex, true, reason);
    return true;
  }

  function resolveResult() {
    const action = fixedRouteResultAction(state, gamePack);
    if (action.kind === 'replay') {
      publish('match.retry_requested', { stageIndex: state.stageIndex, reason: 'stage-defeat' });
    }
    startStage(
      action.stageIndex,
      action.kind === 'complete',
      action.kind === 'replay' ? 'retry' : 'advance',
    );
    return action;
  }

  const mode = {
    matchModeApiVersion: MATCH_MODE_API_VERSION,
    modeId: FIXED_ROUTE_CAMPAIGN_MODE_ID,
    actor: LOCAL_PLAYER_ACTOR,
    actors: Object.freeze([LOCAL_PLAYER_ACTOR]),
    get state() { return state; },
    get highestUnlockedStageIndex() { return highestUnlockedStageIndex(); },
    authorize: authorizeFixedRouteCampaignCommand,
    advance(dt, ...args) {
      const delta = Number(dt);
      if (!Number.isFinite(delta) || delta <= 0) return { advanced: false, reason: 'non-positive-delta' };
      // 标题页只推进确定性 UI 时间；结算页与候选基座一致保持冻结。
      if (state.title) {
        advanceSimulationTime(state, delta);
        return { advanced: false, reason: 'title-time' };
      }
      if (state.over) return { advanced: false, reason: 'match-ended' };
      return advanceRules(state, delta, ...args);
    },
    consumeDomainEvents(events) {
      return consumeFixedRouteCampaignDomainEvents(state, events, { publishDomainEvent });
    },
    startStage,
    selectStage,
    cancelProgressReset,
    requestProgressReset,
    startCurrentStage,
    restart,
    abandon,
    quitToTitle,
    resolveResult,
  };
  return Object.freeze(mode);
}
