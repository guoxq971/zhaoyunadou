// 输入:拖拽(营↔盘、盘内合成)/ 按钮 / 铲子模式
import { CONFIG } from './config.js';
import { UI, benchRect, cellXY } from './render.js';
import { rollGacha, recruitCost, canMerge, detectHero, unlockHero, useShovel, ownedFragChars } from './logic.js';
import { addRing, addText } from './effects.js';
import { sfx } from './audio.js';

const B = CONFIG.board;
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function boardCell(x, y) {
  const c = Math.floor((x - B.ox) / B.cell), r = Math.floor((y - B.oy) / B.cell);
  return (r >= 0 && r < B.rows && c >= 0 && c < B.cols) ? { r, c } : null;
}

export function attachInput(canvas, game, drag) {
  const pt = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches?.[0] ?? e;
    return {
      x: (src.clientX - rect.left) / rect.width * CONFIG.canvas.w,
      y: (src.clientY - rect.top) / rect.height * CONFIG.canvas.h,
    };
  };

  function tryRecruit(state) {
    const cost = recruitCost(state.recruitCount);
    const slot = state.bench.findIndex((b) => b === null);
    if (state.mantou < cost || slot < 0) { sfx('fail'); return; }
    state.mantou -= cost;
    state.recruitCount++;
    state.stats.recruits++;
    const got = rollGacha(Math.random, ownedFragChars(state));
    if (got.kind === 'shovel') {
      state.shovels++;
      addText(state, 210, 620, '得铲子 ×1', '#3a6b35', 1.2);
    } else {
      state.bench[slot] = got;
      const label = got.kind === 'troop' ? CONFIG.troops[got.type].char : got.char;
      addText(state, 210, 620, `募得「${label}」`, '#7d241b', 1.2);
    }
    sfx('recruit');
  }

  function drop(state, x, y) {
    const item = drag.item;
    drag.item = null;
    const cell = boardCell(x, y);
    if (cell) {
      const target = state.grid[cell.r][cell.c];
      if (target.type === 'open' && !target.unit) {
        target.unit = item;
        sfx('place');
        if (item.kind === 'frag') {
          const hit = detectHero(state.grid, cell.r, cell.c);
          if (hit) {
            unlockHero(state, hit);
            const p = cellXY(hit.r, hit.c);
            addRing(state, p.x + B.cell / 2, p.y, '#c8951a', 120);
            addText(state, p.x + B.cell / 2, p.y - 30, `${CONFIG.heroes[hit.key].name} 参战!`, '#8a1f1f', 1.5);
            sfx('hero');
          }
        }
        return;
      }
      if (target.unit && canMerge(target.unit, item)) {
        target.unit.level++;
        target.unit.flash = 0.2;
        state.stats.merges++;
        const p = cellXY(cell.r, cell.c);
        addRing(state, p.x, p.y, '#8a6d3b', 40);
        sfx('merge');
        return;
      }
    } else {
      for (let i = 0; i < CONFIG.benchSize; i++) {
        if (inRect(x, y, benchRect(i)) && state.bench[i] === null) {
          state.bench[i] = item;
          sfx('place');
          return;
        }
      }
    }
    restore(state, item); // 无效落点:放回原处
    sfx('fail');
  }

  function restore(state, item) {
    if (drag.from === 'bench' && state.bench[drag.index] === null) state.bench[drag.index] = item;
    else if (drag.from === 'board' && !state.grid[drag.r][drag.c].unit) state.grid[drag.r][drag.c].unit = item;
    else { const i = state.bench.findIndex((b) => b === null); if (i >= 0) state.bench[i] = item; }
  }

  function down(e) {
    e.preventDefault();
    const state = game.state;
    const { x, y } = pt(e);

    if (state.title) {
      if (inRect(x, y, UI.start)) { state.title = false; sfx('hero'); }
      return;
    }
    if (state.over) {
      if (inRect(x, y, UI.restart)) game.restart();
      return;
    }
    if (state.phase === 'break' && inRect(x, y, UI.callWave)) { state.phaseT = 0; return; }
    if (inRect(x, y, UI.speed)) { state.speed = state.speed === 1 ? 2 : 1; return; }
    if (inRect(x, y, UI.shovel)) {
      drag.mode = drag.mode === 'shovel' ? null : (state.shovels > 0 ? 'shovel' : null);
      return;
    }
    if (inRect(x, y, UI.recruit)) { drag.mode = null; tryRecruit(state); return; }

    if (drag.mode === 'shovel') {
      const cell = boardCell(x, y);
      if (cell && useShovel(state, cell.r, cell.c)) {
        const p = cellXY(cell.r, cell.c);
        addRing(state, p.x, p.y, '#3a6b35', 50);
        sfx('place');
      }
      drag.mode = null;
      return;
    }

    // 营栏起拖
    for (let i = 0; i < CONFIG.benchSize; i++) {
      if (inRect(x, y, benchRect(i)) && state.bench[i]) {
        drag.item = state.bench[i];
        state.bench[i] = null;
        Object.assign(drag, { from: 'bench', index: i, x, y });
        return;
      }
    }
    // 棋盘起拖(兵/单字可拖,英雄与阿斗不可)
    const cell = boardCell(x, y);
    if (cell) {
      const u = state.grid[cell.r][cell.c].unit;
      if (u && (u.kind === 'troop' || u.kind === 'frag')) {
        drag.item = u;
        state.grid[cell.r][cell.c].unit = null;
        Object.assign(drag, { from: 'board', r: cell.r, c: cell.c, x, y });
      }
    }
  }

  function move(e) {
    if (!drag.item) return;
    e.preventDefault();
    const { x, y } = pt(e);
    drag.x = x; drag.y = y;
  }

  function up(e) {
    if (!drag.item) return;
    e.preventDefault();
    const { x, y } = pt(e.changedTouches?.[0] ? { touches: e.changedTouches } : e);
    drop(game.state, x, y);
  }

  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', up);
}
