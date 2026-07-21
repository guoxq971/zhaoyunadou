// 敌军主体按实机采用「贼」字，兵种差异只交给小挂件、尺寸、血条和颜色表达。
import { font } from './render-theme.js';
import { copyText } from './engine-core/public.js';
import { resolveLegacyPresentationGamePack } from './systems/skin-presentation/legacy-game-pack.js';
import { layoutForGamePack } from './systems/ui-interaction/index.js';

function projectedEnemyPosition(state, enemy, layout) {
  if (layout.projection.mode !== 'shallow-perspective') return enemy.position;
  const path = state.paths?.[enemy.lane ?? 0] ?? state.path;
  if (!Array.isArray(path) || path.length === 0) return enemy.position;
  if (path.length === 1) return layout.cellXY(path[0].r, path[0].c);
  const index = Math.min(Math.max(0, Math.floor(enemy.p)), path.length - 2);
  const progress = Math.max(0, Math.min(1, enemy.p - index));
  const from = layout.cellXY(path[index].r, path[index].c);
  const to = layout.cellXY(path[index + 1].r, path[index + 1].c);
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function drawSpeedAccent(ctx, size) {
  ctx.strokeStyle = '#647648';
  ctx.lineWidth = 2;
  for (let index = 0; index < 3; index++) {
    ctx.beginPath();
    ctx.moveTo(-size - 9 - index * 4, -8 + index * 7);
    ctx.lineTo(-size + 1, -8 + index * 7);
    ctx.stroke();
  }
}

function drawTankAccent(ctx, size) {
  ctx.fillStyle = '#69645b';
  ctx.strokeStyle = '#27241f';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-size - 8, -13);
  ctx.quadraticCurveTo(-size + 2, -18, -size + 7, -10);
  ctx.lineTo(-size + 5, 13);
  ctx.quadraticCurveTo(-size - 2, 18, -size - 9, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawEliteAccent(ctx, size, boss) {
  ctx.strokeStyle = boss ? '#d1a02a' : '#8f2922';
  ctx.lineWidth = boss ? 3.2 : 2.4;
  ctx.beginPath();
  ctx.moveTo(size - 1, 13);
  ctx.lineTo(size + 9, -17);
  ctx.stroke();
  ctx.fillStyle = boss ? '#d1a02a' : '#a83028';
  ctx.beginPath();
  ctx.moveTo(size + 9, -17);
  ctx.lineTo(size + 3, -11);
  ctx.lineTo(size + 12, -9);
  ctx.closePath();
  ctx.fill();
  if (boss) {
    ctx.strokeStyle = '#d1a02a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -22);
    ctx.lineTo(-5, -29);
    ctx.lineTo(0, -22);
    ctx.lineTo(6, -30);
    ctx.lineTo(11, -21);
    ctx.stroke();
  }
}

function drawEnemyGlyph(ctx, enemy, type, gamePack) {
  const boss = enemy.type === 'boss';
  const size = (boss ? 22 : 17) * type.size;
  const activeTheme = gamePack.manifests.theme.activeTheme;
  if (activeTheme?.enemyRendererId === 'enemy.calligraphy-only') {
    const scale = activeTheme.pieceStyle?.enemyScale ?? 1;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font((boss ? 42 : Math.round(31 * type.size)) * scale, true, gamePack);
    ctx.shadowColor = 'rgba(74,25,19,0.34)';
    ctx.shadowBlur = activeTheme.pieceStyle?.shadowBlur ?? 5;
    ctx.shadowOffsetY = activeTheme.pieceStyle?.shadowOffsetY ?? 3;
    ctx.fillStyle = boss ? '#7b211c' : '#a73a30';
    ctx.fillText(type.char, 0, 2);
    ctx.restore();
    return;
  }
  if (enemy.type === 'fast') drawSpeedAccent(ctx, size);
  if (enemy.type === 'tank') drawTankAccent(ctx, size);
  if (enemy.type === 'elite' || boss) drawEliteAccent(ctx, size, boss);

  ctx.save();
  ctx.rotate(-0.08);
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(boss ? 42 : Math.round(31 * type.size), true, gamePack);
  ctx.lineWidth = boss ? 5 : 3;
  ctx.strokeStyle = boss ? '#6f1714' : 'rgba(246,236,215,0.92)';
  ctx.strokeText(type.char, 0, 2);
  ctx.fillStyle = enemy.type === 'elite' || boss ? '#7d211c' : '#171512';
  ctx.fillText(type.char, 0, 2);
  ctx.restore();
}

function drawEnemyHealth(ctx, enemy, type, x, y, gamePack) {
  const boss = enemy.type === 'boss';
  const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const width = (boss ? 50 : 31) * type.size;
  const top = y - (boss ? 34 : 25) * type.size;
  ctx.fillStyle = 'rgba(24,20,17,0.9)';
  ctx.fillRect(x - width / 2, top, width, boss ? 6 : 4);
  ctx.fillStyle = boss ? '#c63b2e' : '#d52f3f';
  ctx.fillRect(x - width / 2 + 1, top + 1, (width - 2) * ratio, boss ? 4 : 2);

  ctx.font = font(boss ? 11 : 9, false, gamePack);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(247,239,218,0.96)';
  ctx.strokeText(String(Math.max(0, Math.ceil(enemy.hp))), x, top - 1);
  ctx.fillStyle = '#211e1a';
  ctx.fillText(String(Math.max(0, Math.ceil(enemy.hp))), x, top - 1);
}

export function drawEnemies(ctx, state, gamePack = null) {
  gamePack = resolveLegacyPresentationGamePack(state, gamePack);
  const config = gamePack.config;
  const layout = layoutForGamePack(gamePack);
  for (const enemy of state.enemyViews ?? []) {
    const type = config.enemy.types[enemy.type];
    const position = projectedEnemyPosition(state, enemy, layout);
    const x = position.x;
    const y = position.y + Math.sin(enemy.bob ?? 0) * 2;
    const boss = enemy.type === 'boss';
    const radius = (boss ? 27 : 16) * type.size;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(enemy.bob) * (boss ? 0.015 : 0.035));
    if (boss) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
      ctx.shadowColor = `rgba(128,31,23,${0.35 + pulse * 0.3})`;
      ctx.shadowBlur = 9 + pulse * 8;
    }
    drawEnemyGlyph(ctx, enemy, type, gamePack);
    ctx.shadowColor = 'transparent';
    if (enemy.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.68, enemy.hitFlash / 0.12 * 0.68);
      ctx.fillStyle = '#fff8df';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawEnemyHealth(ctx, enemy, type, x, y, gamePack);
    if (enemy.stun > 0) {
      ctx.fillStyle = '#b8860b';
      ctx.font = font(13, false, gamePack);
      ctx.textAlign = 'center';
      ctx.fillText(copyText(gamePack, 'battle.status.stunned'), x + 17, y - 22);
    }
  }
}
