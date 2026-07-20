// 装配 + 主循环
import { CONFIG } from './config.js';
import { loadProgress, resultAction, settleResult } from './campaign.js';
import { advanceBattle } from './game-loop.js';
import { render } from './render.js';
import { cellXY } from './ui-layout.js';
import { attachInput } from './input.js';
import { initAudio } from './audio.js';
import { createGameController } from './game-controller.js';
import { browserStorage, createSafeStorage } from './storage.js';
import { computeCanvasFit } from './canvas-fit.js';
import { createGameClock } from './game-clock.js';
import { getAssetStatus } from './render-theme.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusOutput = document.getElementById('game-status');

function fit() {
  const box = computeCanvasFit(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  canvas.width = box.pixelWidth;
  canvas.height = box.pixelHeight;
  canvas.style.width = `${box.cssWidth}px`;
  canvas.style.height = `${box.cssHeight}px`;
  ctx.setTransform(box.transformScale, 0, 0, box.transformScale, 0, 0);
}
window.addEventListener('resize', fit);
fit();

const drag = { item: null, x: 0, y: 0, mode: null };
function resetDrag() {
  Object.assign(drag, {
    item: null, x: 0, y: 0, mode: null,
    from: null, index: null, r: null, c: null,
  });
}

const storage = createSafeStorage(browserStorage(window));
const initialProgress = loadProgress(storage);
const game = createGameController(initialProgress, resetDrag);
attachInput(canvas, game, drag);
window.addEventListener('pointerdown', () => { void initAudio(); });
window.addEventListener('touchstart', () => { void initAudio(); });

let announcedStatus = '';
let lastDatasetSignature = '';
let lastStatusSync = -Infinity;
function syncStatus(state, force = false) {
  const now = performance.now();
  if (!force && now - lastStatusSync < 100) return;
  lastStatusSync = now;
  const screen = state.title ? 'title' : state.over ? 'result' : 'battle';
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
  const bench = state.bench.map((item) => {
    if (!item) return '_';
    if (item.kind === 'troop') return `${item.type}${item.level}`;
    if (item.kind === 'frag') return item.char;
    return 'shovel';
  }).join(',');
  const assetStatus = getAssetStatus();
  const boss = state.enemies.find((enemy) => enemy.type === 'boss');
  const dataset = {
    screen,
    stage: String(state.stageIndex + 1),
    stageCount: String(CONFIG.campaign.stages.length),
    stars: String(state.clearedStars),
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
    kills: String(state.stats.kills),
    heroes: state.heroes.map((hero) => hero.key).join(','),
    lastHeroUnlocked: state.lastHeroUnlocked ?? '',
    heroUnlocks: String(state.stats.heroUnlocks ?? 0),
    lastHeroCast: state.lastHeroCast ?? '',
    heroCasts: String(state.stats.heroCasts ?? 0),
    bench,
    board: board.join('|'),
    openCells: String(state.grid.flat().filter((cell) => cell.type === 'open').length),
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
  };
  const signature = JSON.stringify(dataset);
  if (signature !== lastDatasetSignature) {
    lastDatasetSignature = signature;
    Object.assign(canvas.dataset, dataset);
  }
  const label = screen === 'title'
    ? `赵云与阿斗，${CONFIG.campaign.rank}，已获 ${state.clearedStars} 星，第 ${state.stageIndex + 1} 关`
    : screen === 'result'
      ? `${state.win ? '大捷' : '败北'}，第 ${state.stageIndex + 1} 关，第 ${state.wave} 波，歼敌 ${state.stats.kills}`
      : `巨鹿，第 ${state.stageIndex + 1} 关，第 ${Math.max(state.wave, 1)} 波，命 ${state.lives}`;
  if (announcedStatus !== label) {
    announcedStatus = label;
    canvas.setAttribute('aria-label', label);
    statusOutput.textContent = label;
  }
}
syncStatus(game.state, true);

// 逻辑用 setInterval 驱动；后台明确冻结，恢复时重置时钟，避免休眠后跳时。
const clock = createGameClock(() => performance.now());
document.addEventListener('visibilitychange', () => clock.reset());
function step(forcedDt) {
  const s = game.state;
  const dt = forcedDt ?? clock.next(s.speed, document.hidden);

  if (s.title) {
    s.time += dt; // 标题页不推进战局，time 只供入场动画用。
    syncStatus(s);
    return;
  }
  if (!s.over) advanceBattle(s, dt, cellXY);
  if (s.over && !s.saved) {
    const best = Number(storage.getItem('zyad_best') || 0);
    const reached = s.win ? s.wave : Math.max(s.wave - 1, 0);
    if (reached > best) storage.setItem('zyad_best', String(reached));
    settleResult(s, storage);
  }
  syncStatus(s);
}
setInterval(step, 33);

function draw() {
  render(ctx, game.state, drag);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

window.__game = game;  // 调试句柄
window.__step = step;   // 调试:注入 dt 快进,如 __step(0.1)
