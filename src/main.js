// 装配 + 主循环
import { CONFIG } from './config.js';
import { createGame } from './state.js';
import { updateWaves, updateEnemies } from './enemies.js';
import { updateUnits, updateProjectiles } from './units.js';
import { updateHeroes, updateDragonDamage } from './heroes.js';
import { updateEffects } from './effects.js';
import { render, cellXY } from './render.js';
import { attachInput } from './input.js';
import { initAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / CONFIG.canvas.w, window.innerHeight / CONFIG.canvas.h);
  canvas.width = CONFIG.canvas.w * dpr;
  canvas.height = CONFIG.canvas.h * dpr;
  canvas.style.width = `${CONFIG.canvas.w * scale}px`;
  canvas.style.height = `${CONFIG.canvas.h * scale}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fit);
fit();

const game = {
  state: createGame(),
  restart() { this.state = createGame(); this.state.title = false; },
};
const drag = { item: null, x: 0, y: 0, mode: null };
attachInput(canvas, game, drag);
window.addEventListener('pointerdown', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });

// 逻辑用 setInterval 驱动(rAF 在后台/预览环境会被节流,导致游戏冻结),渲染走 rAF
let last = performance.now();
function step(forcedDt) {
  const now = performance.now();
  const s = game.state;
  const dt = forcedDt ?? Math.min((now - last) / 1000, 0.05) * s.speed;
  last = now;

  if (s.title) { s.time += dt; return; } // 标题页不推进战局(time 供高亮脉冲用)
  if (!s.over) {
    s.time += dt;
    updateWaves(s, dt);
    updateEnemies(s, dt, cellXY);
    updateUnits(s, dt, cellXY);
    updateHeroes(s, dt, cellXY);
    updateDragonDamage(s, cellXY);
    updateProjectiles(s, dt, cellXY);
  } else if (!s.saved) {
    s.saved = true;
    const best = Number(localStorage.getItem('zyad_best') || 0);
    const reached = s.win ? s.wave : Math.max(s.wave - 1, 0);
    if (reached > best) localStorage.setItem('zyad_best', String(reached));
  }
  updateEffects(s, dt || 0.016);
}
setInterval(step, 33);

function draw() {
  render(ctx, game.state, drag);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

window.__game = game;  // 调试句柄
window.__step = step;   // 调试:注入 dt 快进,如 __step(0.1)
