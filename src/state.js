// 对局状态工厂 —— 纯数据,渲染/输入不落这里
import { CONFIG } from './config.js';
import { buildMap } from './map.js';

export function createGame() {
  const { grid, path } = buildMap();
  return {
    time: 0,
    speed: 1,
    mantou: CONFIG.startMantou,
    lives: CONFIG.startLives,
    shovels: CONFIG.startShovels,
    recruitCount: 0,
    grid, path,
    bench: Array(CONFIG.benchSize).fill(null), // {kind:'troop',type,level} | {kind:'frag',char}
    heroes: [],      // {key,r,c,cd,ultCd} 占 (r,c)+(r,c+1) 两格
    enemies: [],     // {type,wave,hp,maxHp,p,stun,slowFlash}
    projectiles: [], // {x,y,target,dmg,speed}
    effects: [],     // 见 effects.js
    buff: null,      // {mult,until} 刘备光环
    wave: 0,
    phase: 'break',  // break | wave
    phaseT: 1.5,     // 当前阶段剩余时间(break)/已进行时间(wave)
    spawnLeft: 0,
    spawnT: 0,
    over: false, win: false,
    stats: { kills: 0, merges: 0, recruits: 0 },
  };
}

export const cellAt = (g, r, c) =>
  (r >= 0 && r < g.length && c >= 0 && c < g[0].length) ? g[r][c] : null;
