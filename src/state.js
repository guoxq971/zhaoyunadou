// 对局状态工厂 —— 纯数据,渲染/输入不落这里
import { CONFIG } from './config.js';
import { normalizeClearedStars, normalizeStageIndex } from './campaign.js';
import { buildMap } from './map.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { attachRuntime } from './engine-core/runtime-context.js';

export function createGame(stageIndex = 0, clearedStars = 0, gamePack = DEFAULT_GAME_PACK, runtime) {
  const config = gamePack?.config ?? CONFIG;
  const safeStageIndex = normalizeStageIndex(stageIndex, gamePack);
  const stage = config.campaign.stages[safeStageIndex];
  const { grid, path, paths } = buildMap(gamePack, stage.mapId);
  const state = {
    title: true,   // 标题页(restart 时由 main 置 false 直接开局)
    time: 0,
    resetConfirmUntil: 0,
    resetResult: 'idle',
    speed: 1,
    mantou: config.startMantou,
    lives: config.startLives,
    shovels: config.startShovels,
    brushes: config.startBrushes,
    // 实机中的洛阳铲是被动产铲；普通铲子本身进入营栏后拖到封地使用。
    luoyang: {
      enabled: true,
      elapsed: 0,
      interval: config.luoyangShovel.interval,
      generated: 0,
      pending: false,
    },
    recruitCount: 0,
    // 每关前两次有效征兵给出本关代表英雄双字，保证玩家能真实体验英雄合成链。
    recruitQueue: [...config.heroes[stage.featuredHero].chars],
    stageIndex: safeStageIndex,
    stage,
    waveTarget: stage.waveCount,
    clearedStars: normalizeClearedStars(clearedStars, gamePack),
    grid, path, paths,
    bench: Array.from({ length: config.benchSize }, (_, index) => {
      const type = config.starterUnits[index];
      if (type) return { kind: 'troop', type, level: 1 };
      if (index === config.starterUnits.length && config.startShovels > 0) return { kind: 'shovel' };
      return null;
    }), // troop | frag | shovel
    heroes: [],      // {key,r,c,cd,ultCd} 占 (r,c)+(r,c+1) 两格
    enemies: [],     // {type,wave,hp,maxHp,p,stun,slowFlash}
    projectiles: [], // {x,y,target,dmg,speed}
    effects: [],     // 见 effects.js
    buff: null,      // {mult,until} 刘备光环
    wave: 0,
    phase: 'break',  // break | wave
    phaseT: null,    // 首波等玩家主动开战;后续波次为数字倒计时
    spawnLeft: 0,
    spawnT: 0,
    over: false, win: false,
    lastHeroUnlocked: null,
    lastHeroCast: null,
    stats: {
      kills: 0,
      merges: 0,
      recruits: 0,
      shovelsUsed: 0,
      brushUses: 0,
      luoyangGenerated: 0,
      heroUnlocks: 0,
      heroCasts: 0,
      moves: 0,
      swaps: 0,
    },
  };
  const context = runtime?.gamePack ? runtime : { ...(runtime ?? {}), gamePack };
  return attachRuntime(state, context);
}

export const cellAt = (g, r, c) =>
  (r >= 0 && r < g.length && c >= 0 && c < g[0].length) ? g[r][c] : null;
