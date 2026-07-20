export const FIXED_ROUTE_MATCH_COMMAND_TYPES = Object.freeze([
  'campaign.select_stage',
  'campaign.start_stage',
  'campaign.reset_progress',
  'battle.set_paused',
  'battle.set_speed',
  'battle.retry',
  'result.resolve',
  'session.quit',
]);

const fallbackInvalid = (_command, reason) => ({ ok: false, reason });

function selectionFailure(mode, rawIndex) {
  if (!mode.state.title) return 'not-on-title';
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) return 'invalid-stage';
  if (index > mode.highestUnlockedStageIndex) return 'stage-locked';
  return null;
}

export function createFixedRouteCampaignCommandHandlers({
  matchMode,
  clockControls,
  invalid = fallbackInvalid,
} = {}) {
  if (!matchMode || typeof matchMode !== 'object') {
    throw new TypeError('[match-mode] matchMode is required');
  }
  const setPaused = clockControls?.setSimulationPaused;
  const setSpeed = clockControls?.setSimulationSpeed;
  if (typeof setPaused !== 'function' || typeof setSpeed !== 'function') {
    throw new TypeError('[match-mode] foundation clock controls are required');
  }
  if (typeof invalid !== 'function') throw new TypeError('[match-mode] invalid must be a function');

  const reject = (command, reason, actionId = command.type) => invalid(command, reason, actionId);
  const stateNow = () => matchMode.state;

  return Object.freeze({
    'campaign.select_stage'(command) {
      const reason = selectionFailure(matchMode, command.payload.stageIndex);
      if (reason) return reject(command, reason, 'select-stage');
      const stageIndex = Number(command.payload.stageIndex);
      matchMode.selectStage(stageIndex);
      return { ok: true, reason: 'none', stageIndex };
    },
    'campaign.start_stage'(command) {
      if (!stateNow().title) return reject(command, 'not-on-title');
      if (command.payload.stageIndex !== undefined) {
        const reason = selectionFailure(matchMode, command.payload.stageIndex);
        if (reason) return reject(command, reason, 'start-stage');
        matchMode.selectStage(Number(command.payload.stageIndex));
      }
      matchMode.startCurrentStage();
      return { ok: true, reason: 'none', stageIndex: stateNow().stageIndex };
    },
    'campaign.reset_progress'(command) {
      if (!stateNow().title) {
        return { ...reject(command, 'not-on-title', 'reset-progress'), action: 'ignored' };
      }
      if (command.payload.action === 'cancel') {
        matchMode.cancelProgressReset();
        return { ok: true, reason: 'none', action: 'cancel' };
      }
      return { ok: true, reason: 'none', action: matchMode.requestProgressReset() };
    },
    'battle.set_paused'(command) {
      const state = stateNow();
      if (state.title || state.over) return reject(command, 'not-in-battle');
      const result = setPaused(state, Boolean(command.payload.paused));
      return { ok: true, reason: 'none', ...result };
    },
    'battle.set_speed'(command) {
      const state = stateNow();
      const speed = Number(command.payload.speed);
      if (state.title || state.over) return reject(command, 'not-in-battle');
      if (![0, 1, 2].includes(speed)) return reject(command, 'invalid-speed');
      const result = setSpeed(state, speed);
      return { ok: true, reason: 'none', ...result };
    },
    'battle.retry'(command) {
      if (!stateNow().over) return reject(command, 'result-not-ready');
      matchMode.restart();
      return { ok: true, reason: 'none', stageIndex: stateNow().stageIndex };
    },
    'result.resolve'(command) {
      if (!stateNow().over) return reject(command, 'result-not-ready');
      matchMode.resolveResult();
      return {
        ok: true,
        reason: 'none',
        stageIndex: stateNow().stageIndex,
        title: stateNow().title,
      };
    },
    'session.quit'(command) {
      if (stateNow().title) return reject(command, 'not-in-battle');
      if (!matchMode.quitToTitle(command.payload.reason ?? 'player-quit')) {
        return reject(command, 'quit-rejected');
      }
      return { ok: true, reason: 'none', title: true };
    },
  });
}
