// 水墨粒子 / 飘字 / 弹道 / 技能演出(数据 + 更新;绘制在 render.js)
export function addInk(state, x, y, color = '#1a1a1a') {
  for (let i = 0; i < 4; i++) {
    state.effects.push({
      kind: 'ink', x: x + Math.random() * 14 - 7, y: y + Math.random() * 14 - 7,
      r: 2 + Math.random() * 5, vx: Math.random() * 30 - 15, vy: Math.random() * 30 - 20,
      life: 0.5 + Math.random() * 0.3, t: 0, color,
    });
  }
}

export function addText(state, x, y, text, color = '#222', scale = 1) {
  state.effects.push({ kind: 'text', x, y, text, color, scale, life: 1.0, t: 0 });
}

export function addSlash(state, x, y, ang) {
  state.effects.push({ kind: 'slash', x, y, ang, life: 0.22, t: 0 });
}

export function addRing(state, x, y, color, maxR = 60) {
  state.effects.push({ kind: 'ring', x, y, color, maxR, life: 0.5, t: 0 });
}

// 火龙:沿路径推进的演出体(伤害在 heroes.js 结算)
export function addDragon(state) {
  state.effects.push({ kind: 'dragon', p: 0, speed: 14, life: 5, t: 0, hit: new Set() });
}

export function addRain(state) {
  state.effects.push({ kind: 'rain', life: 0.8, t: 0 });
}

export function updateEffects(state, dt) {
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const f = state.effects[i];
    f.t += dt;
    if (f.kind === 'ink') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 40 * dt; }
    if (f.kind === 'text') { f.y -= 26 * dt; }
    if (f.kind === 'dragon') { f.p += f.speed * dt; if (f.p > state.path.length + 2) f.t = f.life; }
    if (f.t >= f.life) state.effects.splice(i, 1);
  }
}
