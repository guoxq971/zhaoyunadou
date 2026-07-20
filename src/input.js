// 输入:拖拽(营↔盘、盘内合成)/ 按钮 / 铲子模式
import { CONFIG } from './config.js';
import { B, UI, benchRect, boardCell, cellXY, inRect } from './ui-layout.js';
import { canMerge, detectHero, unlockHero, useBrush, useShovel } from './logic.js';
import { attemptRecruit, canStartDrag, restoreDrag } from './actions.js';
import { addRing, addText } from './effects.js';
import { initAudio, sfx } from './audio.js';

export function attachInput(canvas, game, drag) {
  const pt = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches?.[0] ?? e;
    return {
      x: (src.clientX - rect.left) / rect.width * CONFIG.canvas.w,
      y: (src.clientY - rect.top) / rect.height * CONFIG.canvas.h,
    };
  };

  function resetDrag() {
    Object.assign(drag, {
      item: null, x: 0, y: 0, mode: null,
      from: null, index: null, r: null, c: null,
    });
  }

  function tryRecruit(state) {
    const result = attemptRecruit(state, Math.random, drag);
    if (!result.ok) { sfx('fail'); return; }
    const { got } = result;
    const feedbackY = UI.recruit.y - 12;
    if (got.kind === 'shovel') {
      addText(state, 210, feedbackY, '得铲子 ×1', '#3a6b35', 1.2);
    } else {
      const label = got.kind === 'troop' ? CONFIG.troops[got.type].char : got.char;
      addText(state, 210, feedbackY, `募得「${label}」`, '#7d241b', 1.2);
    }
    sfx('recruit');
  }

  function drop(state, x, y) {
    const item = drag.item;
    if (!item) return;
    const cell = boardCell(x, y);
    // 普通铲子和字牌一样从营栏拖出，但只能落到青色封地并在成功后消耗。
    if (item.kind === 'shovel') {
      if (cell && useShovel(state, cell.r, cell.c)) {
        const p = cellXY(cell.r, cell.c);
        addRing(state, p.x, p.y, '#b9851b', 52);
        addText(state, p.x, p.y - 20, '开地', '#8a5b18', 0.95);
        sfx('place');
        resetDrag();
        return;
      }
      restoreDrag(state, drag);
      sfx('fail');
      resetDrag();
      return;
    }
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
            addRing(state, p.x + B.cellW / 2, p.y, '#c8951a', 120);
            addText(state, p.x + B.cellW / 2, p.y - 30, `${CONFIG.heroes[hit.key].name} 参战!`, '#8a1f1f', 1.5);
            sfx('hero');
          }
        }
        resetDrag();
        return;
      }
      if (target.unit && canMerge(target.unit, item)) {
        target.unit.level = (target.unit.level ?? 1) + 1;
        target.unit.flash = 0.2;
        state.stats.merges++;
        const p = cellXY(cell.r, cell.c);
        addRing(state, p.x, p.y, '#8a6d3b', 40);
        sfx('merge');
        resetDrag();
        return;
      }
    } else {
      for (let i = 0; i < CONFIG.benchSize; i++) {
        if (inRect(x, y, benchRect(i)) && state.bench[i] === null) {
          state.bench[i] = item;
          sfx('place');
          resetDrag();
          return;
        }
      }
    }
    restoreDrag(state, drag); // 无效落点:放回原处
    sfx('fail');
    resetDrag();
  }

  function cancelDrag() {
    if (!drag.item) return;
    restoreDrag(game.state, drag);
    sfx('fail');
    resetDrag();
  }

  function togglePause(state) {
    if (state.speed === 0) state.speed = state.resumeSpeed || 1;
    else {
      state.resumeSpeed = state.speed;
      state.speed = 0;
    }
  }

  function toggleShovel(state) {
    drag.mode = drag.mode === 'shovel' ? null : (state.shovels > 0 ? 'shovel' : null);
  }

  function toggleBrush(state) {
    drag.mode = drag.mode === 'brush' ? null : (state.brushes > 0 ? 'brush' : null);
  }

  function applyBrushAt(state, r, c) {
    const rewritten = useBrush(state, r, c);
    if (!rewritten) return false;
    const p = cellXY(r, c);
    addRing(state, p.x, p.y, '#76528e', 54);
    addText(state, p.x, p.y - 20, `改作「${rewritten.char}」`, '#6f3f85', 1.05);
    if (rewritten.hero) {
      unlockHero(state, rewritten.hero);
      addRing(state, p.x + B.cellW / 2, p.y, '#c8951a', 120);
      addText(state, p.x + B.cellW / 2, p.y - 34, `${CONFIG.heroes[rewritten.hero.key].name} 参战!`, '#8a1f1f', 1.5);
      sfx('hero');
    } else sfx('place');
    drag.mode = null;
    return true;
  }

  function keyboardDropTarget(state, item) {
    if (item.kind === 'shovel') {
      for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++)
        if (state.grid[r][c].type === 'locked') return { r, c };
      return null;
    }
    let empty = null;
    for (let r = 0; r < B.rows; r++) {
      for (let c = 0; c < B.cols; c++) {
        const cell = state.grid[r][c];
        if (cell.type !== 'open') continue;
        if (cell.unit && canMerge(cell.unit, item)) return { r, c };
        if (!cell.unit && !empty) empty = { r, c };
      }
    }
    return empty;
  }

  function down(e) {
    e.preventDefault();
    if (!canStartDrag(drag, e.button)) return;
    canvas.focus({ preventScroll: true });
    const state = game.state;
    const { x, y } = pt(e);

    if (state.title) {
      if (inRect(x, y, UI.start)) { game.startCurrentStage(); sfx('hero'); }
      return;
    }
    if (state.over) {
      if (inRect(x, y, UI.restart)) game.resolveResult();
      return;
    }
    if (inRect(x, y, UI.pause)) {
      togglePause(state);
      return;
    }
    if (state.phase === 'break' && inRect(x, y, UI.callWave)) { state.phaseT = 0; return; }
    if (inRect(x, y, UI.speed)) {
      state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 0 : 1;
      return;
    }
    if (inRect(x, y, UI.shovel)) {
      toggleBrush(state);
      return;
    }
    if (inRect(x, y, UI.recruit)) { drag.mode = null; tryRecruit(state); return; }

    if (drag.mode === 'brush') {
      const cell = boardCell(x, y);
      if (!cell || !applyBrushAt(state, cell.r, cell.c)) sfx('fail');
      return;
    }

    if (drag.mode === 'shovel') {
      const cell = boardCell(x, y);
      const shovelSlot = state.bench.findIndex((item) => item?.kind === 'shovel');
      if (cell && shovelSlot >= 0 && useShovel(state, cell.r, cell.c)) {
        state.bench[shovelSlot] = null;
        const p = cellXY(cell.r, cell.c);
        addRing(state, p.x, p.y, '#b9851b', 52);
        addText(state, p.x, p.y - 20, '开地', '#8a5b18', 0.95);
        sfx('place');
        drag.mode = null;
      } else {
        sfx('fail');
      }
      return;
    }

    // 营栏起拖
    for (let i = 0; i < CONFIG.benchSize; i++) {
      if (inRect(x, y, benchRect(i)) && state.bench[i]) {
        drag.item = state.bench[i];
        state.bench[i] = null;
        Object.assign(drag, { from: 'bench', index: i, r: null, c: null, x, y });
        return;
      }
    }
    // 棋盘起拖(兵/单字可拖,英雄、铲子与阿斗不可)
    const cell = boardCell(x, y);
    if (cell) {
      const u = state.grid[cell.r][cell.c].unit;
      if (u && (u.kind === 'troop' || u.kind === 'frag')) {
        drag.item = u;
        state.grid[cell.r][cell.c].unit = null;
        Object.assign(drag, { from: 'board', index: null, r: cell.r, c: cell.c, x, y });
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

  function keydown(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    // 键盘是可信用户手势；Enter/R/P 也要触发 WebAudio 解锁与后续重试。
    void initAudio();
    const state = game.state;
    let handled = true;
    if (e.code === 'Enter' || e.code === 'Space') {
      if (drag.mode === 'brush') {
        let target = null;
        for (let r = 0; r < B.rows && !target; r++) for (let c = 0; c < B.cols; c++)
          if (['troop', 'frag'].includes(state.grid[r][c].unit?.kind)) { target = { r, c }; break; }
        if (!target || !applyBrushAt(state, target.r, target.c)) handled = false;
      } else if (drag.item) {
        const target = keyboardDropTarget(state, drag.item);
        if (target) {
          const p = cellXY(target.r, target.c);
          drop(state, p.x, p.y);
        } else handled = false;
      } else if (state.title) game.startCurrentStage();
      else if (state.over) game.resolveResult();
      else if (state.phase === 'break') state.phaseT = 0;
      else handled = false;
    } else if (e.code === 'KeyP' && !state.title && !state.over) {
      togglePause(state);
    } else if (e.code === 'KeyR' && !state.title && !state.over) {
      drag.mode = null;
      tryRecruit(state);
    } else if (e.code === 'KeyB' && !state.title && !state.over) {
      toggleBrush(state);
    } else if (e.code === 'KeyX' && !state.title && !state.over) {
      toggleShovel(state);
    } else if (/^Digit[1-5]$/.test(e.code) && !state.title && !state.over && !drag.item) {
      // 数字键拿起营栏字牌，随后点击棋盘即可部署/合成；给键盘与自动化测试一条真实输入路径。
      const index = Number(e.code.slice(-1)) - 1;
      const item = state.bench[index];
      if (item) {
        drag.item = item;
        state.bench[index] = null;
        Object.assign(drag, {
          from: 'bench', index, r: null, c: null,
          x: benchRect(index).x + UI.bench.w / 2,
          y: UI.bench.y + UI.bench.h / 2,
        });
      } else handled = false;
    } else handled = false;
    if (handled) e.preventDefault();
  }

  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', up);
  window.addEventListener('touchcancel', cancelDrag);
  window.addEventListener('blur', cancelDrag);
  window.addEventListener('keydown', keydown);
}
