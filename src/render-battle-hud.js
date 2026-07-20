// 战斗态势层：参考图式悬浮资源、波次、装备、Boss、暂停与临近失守提示。
import { CONFIG } from './config.js';
import { B, UI, boardHeight, boardWidth } from './ui-layout.js';
import { drawToolAtlasIcon, font, roundRect } from './render-theme.js';

function drawHeart(ctx, x, y, size, filled = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.32);
  ctx.bezierCurveTo(-size * 0.55, -size * 0.06, -size * 0.46, -size * 0.5, 0, -size * 0.22);
  ctx.bezierCurveTo(size * 0.46, -size * 0.5, size * 0.55, -size * 0.06, 0, size * 0.32);
  ctx.fillStyle = filled ? '#d52e43' : 'rgba(117,91,72,0.24)';
  ctx.fill();
  ctx.strokeStyle = '#64211f';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawPauseButton(ctx, paused) {
  const { x, y, w, h } = UI.pause;
  ctx.save();
  ctx.shadowColor = 'rgba(44,31,21,0.34)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#d8c8ac';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2 - 3, h / 2, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#574a3c';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = '#5f5345';
  if (paused) {
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 14);
    ctx.lineTo(x + 34, y + 24);
    ctx.lineTo(x + 18, y + 34);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(x + 16, y + 13, 6, 22);
    ctx.fillRect(x + 27, y + 13, 6, 22);
  }
  ctx.restore();
}

function drawResources(ctx, state) {
  const shown = Math.min(10, state.lives);
  for (let index = 0; index < 10; index++) {
    const col = index % 5;
    const row = Math.floor(index / 5);
    drawHeart(ctx, 18 + col * 11, 64 + row * 11, 9, index < shown);
  }
  ctx.save();
  ctx.fillStyle = '#f5ecdc';
  ctx.beginPath();
  ctx.ellipse(91, 74, 18, 12, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8d795e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#2b241c';
  ctx.font = font(19);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(state.mantou), 112, 75);
  ctx.restore();
}

function drawStageWave(ctx, state) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(247,238,216,0.96)';
  ctx.fillStyle = '#201d19';
  ctx.lineWidth = 4;
  ctx.font = font(22);
  ctx.strokeText('巨鹿', 210, 27);
  ctx.fillText('巨鹿', 210, 27);
  ctx.font = font(21);
  const wave = Math.max(1, state.wave || 1);
  ctx.strokeText(`第${wave}波`, 210, 50);
  ctx.fillText(`第${wave}波`, 210, 50);
  ctx.restore();
}

function drawEquipmentIcons(ctx, state) {
  const icons = [1, 2, 11, 4, 5];
  for (let index = 0; index < 5; index++) {
    const x = 286 + index * 24;
    const y = 53;
    ctx.fillStyle = '#27251f';
    roundRect(ctx, x, y, 21, 21, 3);
    ctx.fill();
    const equipped = index === 0 && state.luoyang?.enabled;
    ctx.strokeStyle = equipped ? '#d3aa2b' : '#756957';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = equipped ? 1 : 0.46;
    drawToolAtlasIcon(ctx, icons[index], x + 2, y + 2, 17, 17);
    ctx.restore();
  }
}

export function drawTopBar(ctx, state) {
  drawPauseButton(ctx, state.speed === 0 && !state.over);
  drawResources(ctx, state);
  drawStageWave(ctx, state);
  drawEquipmentIcons(ctx, state);
}

function drawBossBar(ctx, boss) {
  const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  ctx.save();
  ctx.fillStyle = 'rgba(45,18,14,0.94)';
  roundRect(ctx, 88, 69, 244, 23, 4);
  ctx.fill();
  ctx.strokeStyle = '#c99a2b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f3dfb2';
  ctx.font = font(12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('魁首', 96, 81);
  ctx.fillStyle = 'rgba(245,227,189,0.18)';
  roundRect(ctx, 132, 76, 190, 9, 3);
  ctx.fill();
  const blood = ctx.createLinearGradient(132, 0, 322, 0);
  blood.addColorStop(0, '#711b18');
  blood.addColorStop(1, '#c44834');
  ctx.fillStyle = blood;
  roundRect(ctx, 133, 77, 188 * ratio, 7, 2);
  ctx.fill();
  ctx.restore();
}

function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(24,19,13,0.48)';
  ctx.fillRect(B.ox - 2, B.oy - 2, boardWidth + 4, boardHeight + 4);
  ctx.fillStyle = 'rgba(239,225,197,0.96)';
  roundRect(ctx, 112, 273, 196, 82, 5);
  ctx.fill();
  ctx.strokeStyle = '#7d2e25';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#7d241b';
  ctx.font = font(28);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('战局暂停', 210, 304);
  ctx.fillStyle = '#554737';
  ctx.font = font(14, false);
  ctx.fillText('点左上暂停或按 P 继续', 210, 335);
  ctx.restore();
}

function drawReadyBanner(ctx, state) {
  const waiting = state.phaseT === null;
  const rect = UI.callWave;
  ctx.fillStyle = waiting ? 'rgba(146,45,35,0.94)' : 'rgba(43,36,28,0.9)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,226,194,0.72)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#f7ead1';
  ctx.font = font(waiting ? 15 : 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(waiting ? '点击迎敌' : `来袭 · ${Math.ceil(state.phaseT)}`, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

export function drawBattleSignals(ctx, state) {
  const paused = state.speed === 0 && !state.over;
  const boss = state.enemies.find((enemy) => enemy.type === 'boss');
  if (boss) drawBossBar(ctx, boss);
  else if (state.phase === 'break' && !state.over) drawReadyBanner(ctx, state);

  if (boss && state.time - (boss.spawnedAt ?? -Infinity) < 1) {
    const alpha = Math.max(0, 1 - (state.time - boss.spawnedAt));
    ctx.fillStyle = `rgba(118,24,20,${alpha * 0.32})`;
    ctx.fillRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
    ctx.fillStyle = `rgba(125,32,25,${alpha})`;
    ctx.font = font(36);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('魁首来袭', 210, 242);
  }

  const endNear = state.enemies.some((enemy) => {
    const path = state.paths?.[enemy.lane ?? 0] ?? state.path;
    return enemy.p > path.length * 0.78;
  });
  if (endNear) {
    const pulse = Math.abs(Math.sin(state.time * 5));
    ctx.strokeStyle = `rgba(160,32,32,${0.35 + pulse * 0.5})`;
    ctx.lineWidth = 7;
    ctx.strokeRect(4, 4, CONFIG.canvas.w - 8, CONFIG.canvas.h - 8);
    ctx.fillStyle = `rgba(160,32,32,${0.5 + pulse * 0.5})`;
    ctx.font = font(30);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('危', B.ox + 7.5 * B.cellW, B.oy + 9.5 * B.cellH);
  }
  if (paused) drawPause(ctx);
}
