import { resultAction } from '../campaign.js';
import { copyText } from '../engine-core/copy.js';
import { getAssetStatus } from '../render-theme.js';

function boardSignature(state) {
  const board = [];
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < state.grid[r].length; c++) {
      const unit = state.grid[r][c].unit;
      if (!unit) continue;
      const id = unit.kind === 'troop' ? `${unit.type}${unit.level}`
        : unit.kind === 'frag' ? unit.char : `${unit.key}:${unit.part}`;
      board.push(`${r}.${c}:${id}`);
    }
  }
  return board.join('|');
}

function benchSignature(state) {
  return state.bench.map((item) => {
    if (!item) return '_';
    if (item.kind === 'troop') return `${item.type}${item.level}`;
    if (item.kind === 'frag') return item.char;
    return 'shovel';
  }).join(',');
}

export function createGameStatusSynchronizer({ game, gamePack, drag, storage, host, commandLog }) {
  const config = gamePack.config;
  let announcedStatus = '';
  let lastDatasetSignature = '';
  let lastStatusSync = -Infinity;

  return function syncStatus(state, force = false) {
    const now = host.scheduler.now();
    if (!force && now - lastStatusSync < 100) return;
    lastStatusSync = now;
    const screen = state.title ? 'title' : state.over ? 'result' : 'battle';
    const assetStatus = getAssetStatus(gamePack, host);
    const boss = state.enemies.find((enemy) => enemy.type === 'boss');
    const dataset = {
      screen,
      stage: String(state.stageIndex + 1),
      selectedStage: String(state.stageIndex + 1),
      stageCount: String(config.campaign.stages.length),
      highestUnlockedStage: String(game.highestUnlockedStageIndex + 1),
      stars: String(state.clearedStars),
      titleMode: state.title && state.resetConfirmUntil > state.time ? 'reset-confirm' : 'normal',
      resetResult: state.resetResult ?? 'idle',
      wave: String(state.wave),
      waveTarget: String(state.waveTarget),
      phase: state.phase,
      phaseReady: String(state.phaseT === null),
      lives: String(state.lives),
      speed: String(state.speed),
      paused: String(state.speed === 0 && !state.title && !state.over),
      inputMode: drag.mode ?? '',
      mantou: String(state.mantou),
      shovels: String(state.shovels),
      shovelsUsed: String(state.stats.shovelsUsed ?? 0),
      luoyangEnabled: String(Boolean(state.luoyang?.enabled)),
      luoyangRemaining: String(Math.max(0, Math.ceil((state.luoyang?.interval ?? 0) - (state.luoyang?.elapsed ?? 0)))),
      luoyangGenerated: String(state.stats.luoyangGenerated ?? 0),
      luoyangPending: String(Boolean(state.luoyang?.pending)),
      brushes: String(state.brushes),
      brushUses: String(state.stats.brushUses ?? 0),
      recruits: String(state.stats.recruits),
      merges: String(state.stats.merges),
      moves: String(state.stats.moves ?? 0),
      swaps: String(state.stats.swaps ?? 0),
      kills: String(state.stats.kills),
      heroes: state.heroes.map((hero) => hero.key).join(','),
      lastHeroUnlocked: state.lastHeroUnlocked ?? '',
      heroUnlocks: String(state.stats.heroUnlocks ?? 0),
      lastHeroCast: state.lastHeroCast ?? '',
      heroCasts: String(state.stats.heroCasts ?? 0),
      bench: benchSignature(state),
      board: boardSignature(state),
      openCells: String(state.grid.flat().filter((cell) => cell.type === 'open').length),
      routeLanes: String(state.paths?.length ?? 1),
      commandCount: String(commandLog?.size ?? 0),
      commandDropped: String(commandLog?.dropped ?? 0),
      lastCommandType: drag.lastCommand?.type ?? '',
      lastCommandResult: drag.lastCommand?.ok === undefined ? '' : String(drag.lastCommand.ok),
      lastCommandReason: drag.lastCommand?.reason ?? '',
      lastCommandAction: drag.lastCommand?.action ?? '',
      batchFilled: String(drag.lastRecruitBatch?.filledCount ?? 0),
      batchCost: String(drag.lastRecruitBatch?.totalCost ?? 0),
      batchStopReason: drag.lastRecruitBatch?.stopReason ?? '',
      over: String(state.over),
      win: String(state.win),
      resultAction: state.over ? resultAction(state).kind : '',
      bossActive: String(Boolean(boss)),
      bossHp: boss ? String(Math.max(0, Math.ceil(boss.hp))) : '',
      bossMaxHp: boss ? String(boss.maxHp) : '',
      saveWarning: String(Boolean(state.saveWarning)),
      assetsReady: String(assetStatus.ready),
      assetFailures: String(assetStatus.failed),
      storageMode: storage.persistent ? 'persistent' : 'memory',
      storageScope: storage.scope || 'normal',
    };
    const signature = JSON.stringify(dataset);
    if (signature !== lastDatasetSignature) {
      lastDatasetSignature = signature;
      try { host.surface.setStateDataset(dataset); } catch { /* 辅助输出不反向中断玩法 */ }
    }
    const titleNotice = state.resetConfirmUntil > state.time
      ? copyText(gamePack, 'status.resetConfirm')
      : state.resetResult === 'memory-only' ? copyText(gamePack, 'status.resetMemoryOnly') : '';
    const label = screen === 'title'
      ? copyText(gamePack, 'status.title', {
        rank: config.campaign.rank, stars: state.clearedStars, stage: state.stageIndex + 1, notice: titleNotice,
      })
      : screen === 'result'
        ? copyText(gamePack, 'status.result', {
          result: copyText(gamePack, state.win ? 'result.victory' : 'result.defeat'),
          stage: state.stageIndex + 1, wave: state.wave, kills: state.stats.kills,
        })
        : copyText(gamePack, 'status.battle', {
          stage: state.stageIndex + 1, wave: Math.max(state.wave, 1), lives: state.lives,
        });
    if (announcedStatus !== label) {
      announcedStatus = label;
      try { host.surface.setAccessibleStatus(label); } catch { /* 无障碍故障不中断玩法 */ }
    }
  };
}
