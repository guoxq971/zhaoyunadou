// 参考原作的信息密度重绘标题页；未实现的设置、排行与背包只作静态陈列。
import { stageIndexForProgress } from './campaign.js';
import { UI, titleStageRect } from './ui-layout.js';
import {
  assetsFor, drawPaper, drawStars, font, presentationTokens, roundRect, themeColors,
} from './render-theme.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { gamePackFor } from './engine-core/runtime-context.js';
import { copyText } from './engine-core/copy.js';

function inkLine(ctx, x1, y1, x2, y2, width = 2, color = '#473629') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2 + 2, (y1 + y2) / 2 - 2, x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawAvatar(ctx, x, y, gamePack) {
  ctx.save();
  ctx.fillStyle = 'rgba(48,42,34,0.25)';
  roundRect(ctx, x + 3, y + 4, 42, 42, 4); ctx.fill();
  ctx.fillStyle = '#6c7b7c';
  roundRect(ctx, x, y, 42, 42, 4); ctx.fill();
  ctx.strokeStyle = '#27231e'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#eee4d0';
  roundRect(ctx, x + 7, y + 6, 25, 28, 5); ctx.fill();
  ctx.strokeStyle = '#3c3025'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#312721';
  ctx.beginPath(); ctx.arc(x + 19, y + 14, 7, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#2d2924'; ctx.font = font(13);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, 'title.avatar.glyph'), x + 19, y + 26);
  ctx.fillStyle = '#8c3b2d';
  ctx.beginPath(); ctx.moveTo(x + 29, y + 28); ctx.lineTo(x + 40, y + 37); ctx.lineTo(x + 31, y + 39); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawCoinPill(ctx, x, y, value, gamePack) {
  ctx.save();
  ctx.shadowColor = 'rgba(54,39,24,0.34)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(x, y, x + 126, y);
  g.addColorStop(0, '#372c24'); g.addColorStop(1, 'rgba(79,58,39,0.76)');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, 126, 35, 18); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#f2bc17'; ctx.strokeStyle = '#8c5c08'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + 20, y + 17.5, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6d3f08'; ctx.font = font(16);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, 'title.coin.glyph'), x + 20, y + 18);
  ctx.fillStyle = '#ffe36e'; ctx.font = font(17);
  ctx.fillText(String(value), x + 74, y + 18);
  ctx.restore();
}

function drawGear(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#61777a'; ctx.strokeStyle = '#2b3434'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-4, -22, 8, 11); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#dfd5c0'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawEnergy(ctx, x, y, current, max) {
  ctx.save();
  ctx.fillStyle = 'rgba(48,40,31,0.86)';
  roundRect(ctx, x, y, 132, 35, 18); ctx.fill();
  ctx.fillStyle = '#ffcf25'; ctx.strokeStyle = '#7f5509'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 3); ctx.lineTo(x + 8, y + 20); ctx.lineTo(x + 18, y + 20);
  ctx.lineTo(x + 12, y + 33); ctx.lineTo(x + 31, y + 13); ctx.lineTo(x + 21, y + 13);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff5d7'; ctx.font = font(16);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${current}/${max}`, x + 73, y + 18);
  ctx.fillStyle = '#58a632'; ctx.strokeStyle = '#254d19';
  ctx.beginPath(); ctx.arc(x + 120, y + 17.5, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = font(18); ctx.fillText('+', x + 120, y + 18);
  ctx.restore();
}

function drawStageSelector(ctx, state, gamePack) {
  const config = gamePack.config;
  const colors = themeColors(gamePack);
  const copy = (id, values, fallback) => copyText(gamePack, id, values, fallback);
  const numerals = gamePack.manifests.copy.stageNumerals;
  const highest = stageIndexForProgress(state.clearedStars, gamePack);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  config.campaign.stages.forEach((stage, index) => {
    const rect = titleStageRect(index);
    const selected = index === state.stageIndex;
    const unlocked = index <= highest;
    const cleared = index < state.clearedStars;
    ctx.save();
    if (selected) {
      ctx.shadowColor = 'rgba(58,45,29,0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
    }
    ctx.fillStyle = selected ? colors.paperRaised : unlocked ? 'rgba(245,235,214,0.96)' : colors.disabledSurface;
    ctx.strokeStyle = selected ? colors.cinnabarPrimary : unlocked ? colors.inkMuted : colors.disabledInk;
    ctx.lineWidth = selected ? 2 : 1;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
    ctx.fill(); ctx.stroke();
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = selected ? colors.cinnabarPrimary : unlocked ? colors.inkStrong : colors.disabledInk;
    ctx.font = font(19);
    ctx.fillText(unlocked ? numerals[index] : copy('title.stage.locked'), rect.x + rect.w / 2, rect.y + 19);
    ctx.font = font(10, false);
    ctx.fillText(unlocked ? copy('title.stage.unlocked') : copy('title.stage.notUnlocked'), rect.x + rect.w / 2, rect.y + 37);
    if (cleared) {
      ctx.fillStyle = colors.goldReward;
      ctx.strokeStyle = '#76500b';
      ctx.lineWidth = 1;
      ctx.font = font(12, false);
      ctx.strokeText('★', rect.x + rect.w - 8, rect.y + 8);
      ctx.fillText('★', rect.x + rect.w - 8, rect.y + 8);
    }
    if (selected) {
      ctx.fillStyle = colors.cinnabarPrimary;
      ctx.fillRect(rect.x + 7, rect.y + rect.h - 4, rect.w - 14, 2);
    }
    ctx.restore();
  });

  ctx.fillStyle = colors.inkMuted;
  ctx.font = font(13);
  ctx.fillText(
    copy('title.stage.summary', {
      stage: state.stageIndex + 1,
      stageName: state.stage?.name ?? config.campaign.stages[0].name,
      unlocked: highest + 1,
      total: config.campaign.stages.length,
    }),
    210,
    310,
  );
  ctx.restore();
}

function drawResetProgress(ctx, state, gamePack) {
  const rect = UI.resetProgress;
  const confirming = state.resetConfirmUntil > state.time;
  ctx.save();
  ctx.fillStyle = confirming ? 'rgba(151,55,42,0.92)' : 'rgba(225,211,181,0.86)';
  ctx.strokeStyle = confirming ? '#6d281f' : '#66543e';
  ctx.lineWidth = 1.5;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = confirming ? '#fff0d3' : '#5a4936';
  ctx.font = font(confirming ? 14 : 13, false);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, confirming ? 'title.reset.confirm' : 'title.reset'), rect.x + rect.w / 2, rect.y + rect.h / 2);
  if (!confirming && state.resetResult === 'memory-only') {
    ctx.fillStyle = '#8f3328';
    ctx.font = font(10, false);
    ctx.fillText(copyText(gamePack, 'title.reset.memoryOnly'), 210, rect.y - 9);
  }
  ctx.restore();
}

function drawCrossedBlades(ctx) {
  ctx.save();
  ctx.translate(210, UI.start.y - 4);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1); ctx.rotate(-0.56);
    ctx.strokeStyle = '#252d2f'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-3, 11); ctx.lineTo(4, -43); ctx.stroke();
    ctx.strokeStyle = '#d7eef0'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#7f3227'; ctx.fillRect(-8, 7, 16, 6);
    ctx.strokeStyle = '#35251e'; ctx.lineWidth = 2; ctx.strokeRect(-8, 7, 16, 6);
    ctx.restore();
  }
  ctx.restore();
}

function drawStartButton(ctx, gamePack) {
  const rect = UI.start;
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  ctx.save();
  ctx.shadowColor = 'rgba(51,30,21,0.34)';
  ctx.shadowBlur = tokens.shadows.buttonBlur + 2; ctx.shadowOffsetY = 4;
  ctx.fillStyle = colors.cinnabarAction;
  ctx.strokeStyle = colors.inkStructure; ctx.lineWidth = tokens.strokes.strong;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 3); ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = colors.paperLight; ctx.globalAlpha = 0.68; ctx.lineWidth = tokens.strokes.hairline;
  roundRect(ctx, rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14, 1); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.paperRaised; ctx.strokeStyle = colors.inkStrong; ctx.lineWidth = 3;
  ctx.font = font(29); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = copyText(gamePack, 'title.start');
  ctx.strokeText(label, rect.x + rect.w / 2 - 4, rect.y + rect.h / 2 + 2);
  ctx.fillText(label, rect.x + rect.w / 2 - 4, rect.y + rect.h / 2 + 2);
  ctx.fillStyle = '#ffd12d'; ctx.strokeStyle = '#6b4007'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w - 24, rect.y + 17); ctx.lineTo(rect.x + rect.w - 35, rect.y + 37);
  ctx.lineTo(rect.x + rect.w - 26, rect.y + 37); ctx.lineTo(rect.x + rect.w - 32, rect.y + 53);
  ctx.lineTo(rect.x + rect.w - 13, rect.y + 30); ctx.lineTo(rect.x + rect.w - 23, rect.y + 30);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawRanking(ctx, gamePack) {
  const tokens = presentationTokens(gamePack);
  ctx.save();
  ctx.globalAlpha = tokens.title.peripheralAlpha;
  ctx.translate(59, 633);
  ctx.fillStyle = '#e5d4b3'; ctx.strokeStyle = '#3b3026'; ctx.lineWidth = 2;
  roundRect(ctx, -22, 0, 44, 52, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3d342a'; ctx.font = font(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, 'title.ranking'), 0, 10);
  ctx.fillStyle = '#b47726';
  for (let i = 0; i < 3; i++) ctx.fillRect(-13 + i * 10, 24 + i * 4, 7, 17 - i * 4);
  ctx.strokeStyle = '#3d3024'; ctx.lineWidth = 1;
  ctx.strokeRect(-13, 24, 7, 17); ctx.strokeRect(-3, 28, 7, 13); ctx.strokeRect(7, 32, 7, 9);
  ctx.restore();
}

function drawBackpack(ctx, gamePack) {
  const tokens = presentationTokens(gamePack);
  ctx.save();
  ctx.globalAlpha = tokens.title.peripheralAlpha;
  ctx.translate(352, 640);
  ctx.fillStyle = '#aa632d'; ctx.strokeStyle = '#38281e'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-22, 4); ctx.quadraticCurveTo(-20, -17, 0, -17);
  ctx.quadraticCurveTo(20, -17, 22, 4); ctx.lineTo(18, 30);
  ctx.quadraticCurveTo(0, 39, -18, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e59b3d';
  roundRect(ctx, -17, 3, 34, 18, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5d4a32'; ctx.fillRect(-4, 2, 8, 20);
  ctx.strokeStyle = '#3b2e22'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, -13, 12, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#8c4b29'; ctx.font = font(12);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(copyText(gamePack, 'title.backpack'), 0, 44);
  ctx.restore();
}

function drawMountainWash(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#4d574b';
  ctx.beginPath();
  ctx.moveTo(0, 664); ctx.quadraticCurveTo(46, 620, 94, 665); ctx.quadraticCurveTo(146, 714, 201, 675);
  ctx.quadraticCurveTo(251, 636, 304, 678); ctx.quadraticCurveTo(360, 718, 420, 662); ctx.lineTo(420, 760); ctx.lineTo(0, 760); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawInkBackdrop(ctx) {
  ctx.save();
  // 参考图的暗色洞口只压住四周，中央保持宣纸高光和标题可读性。
  const topShade = ctx.createRadialGradient(210, 104, 72, 210, 80, 285);
  topShade.addColorStop(0, 'rgba(255,250,231,0)');
  topShade.addColorStop(0.58, 'rgba(92,81,62,0.10)');
  topShade.addColorStop(1, 'rgba(40,35,29,0.60)');
  ctx.fillStyle = topShade; ctx.fillRect(0, 0, 420, 220);

  ctx.fillStyle = 'rgba(53,53,43,0.28)';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 151); ctx.quadraticCurveTo(34, 126, 65, 141);
  ctx.quadraticCurveTo(98, 116, 122, 86); ctx.quadraticCurveTo(101, 39, 69, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(420, 0); ctx.lineTo(420, 166); ctx.quadraticCurveTo(387, 130, 350, 144);
  ctx.quadraticCurveTo(324, 105, 302, 83); ctx.quadraticCurveTo(331, 38, 356, 0); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(91,100,82,0.17)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (const offset of [-8, 8]) {
    ctx.beginPath();
    ctx.moveTo(112 + offset, 105); ctx.quadraticCurveTo(154, 68, 192, 103);
    ctx.quadraticCurveTo(232, 137, 304 - offset, 93); ctx.stroke();
  }
  ctx.restore();
}

function drawMascotFallback(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // 枪与红缨位于人物之后，轮廓保持手机尺寸下仍清晰。
  ctx.strokeStyle = '#29251f'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-23, 50); ctx.lineTo(24, -43); ctx.stroke();
  ctx.strokeStyle = '#ded9c5'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-22, 49); ctx.lineTo(24, -43); ctx.stroke();
  ctx.fillStyle = '#9f352b';
  ctx.beginPath(); ctx.moveTo(20, -34); ctx.lineTo(4, -23); ctx.lineTo(23, -19); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#e5b52e'; ctx.strokeStyle = '#30281f'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, 6); ctx.quadraticCurveTo(-25, 24, -16, 51);
  ctx.lineTo(15, 51); ctx.quadraticCurveTo(24, 22, 13, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#bf4b34';
  ctx.beginPath(); ctx.moveTo(-12, 22); ctx.lineTo(-28, 43); ctx.lineTo(-8, 39); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#30281f'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = '#eed8b5';
  ctx.beginPath(); ctx.arc(0, -5, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#41443e';
  ctx.beginPath(); ctx.arc(0, -9, 14, Math.PI, 0); ctx.lineTo(12, -2); ctx.lineTo(-12, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b43f30';
  ctx.beginPath(); ctx.moveTo(0, -21); ctx.quadraticCurveTo(7, -35, 1, -44);
  ctx.quadraticCurveTo(-7, -34, -3, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#28231e';
  ctx.beginPath(); ctx.arc(-5, -5, 1.5, 0, Math.PI * 2); ctx.arc(5, -5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTitleBoard(ctx, state, gamePack, host) {
  ctx.save();
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  ctx.fillStyle = 'rgba(56,118,95,0.16)';
  ctx.beginPath(); ctx.ellipse(210, 402, 126, 48, -0.02, 0, Math.PI * 2); ctx.fill();

  ctx.shadowColor = 'rgba(70,56,38,0.24)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
  ctx.fillStyle = colors.paperRaised; ctx.strokeStyle = colors.inkMuted; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(121, 330); ctx.lineTo(302, 329); ctx.lineTo(284, 417); ctx.lineTo(137, 417); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = 'rgba(111,91,62,0.63)'; ctx.lineWidth = 1.6;
  for (let i = 1; i < 4; i++) inkLine(ctx, 121 + i * 45, 330, 137 + i * 37, 417, 1.5, 'rgba(111,91,62,0.63)');
  inkLine(ctx, 129, 372, 293, 371, 1.5, 'rgba(111,91,62,0.63)');

  // 大“斗”是标题页最醒目的棋子语义；黄色“云”块提示合字成将。
  ctx.fillStyle = '#f1e8d4'; ctx.strokeStyle = '#5b4935'; ctx.lineWidth = 2;
  roundRect(ctx, 150, 339, 58, 59, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#25221e'; ctx.font = font(51);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, 'title.board.protectedGlyph'), 179, 370);

  ctx.fillStyle = '#e8bb3e'; ctx.strokeStyle = '#8a5a16';
  roundRect(ctx, 214, 350, 43, 43, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7f351f'; ctx.font = font(29);
  ctx.fillText(copyText(gamePack, 'title.board.heroGlyph'), 236, 372);

  const source = state?.theme?.images?.titleMascot || assetsFor(gamePack, host).titleMascot;
  const image = source?.status === 'ready' ? source.image : source;
  if (image?.complete || image?.naturalWidth || image?.width) {
    // 按素材原始比例装入棋盘，避免长枪和人物被压扁。
    const ratio = (image.naturalWidth || image.width) / (image.naturalHeight || image.height);
    const width = Math.min(tokens.title.mascotMaxWidth, tokens.title.mascotWidth * ratio);
    const height = width / ratio;
    ctx.drawImage(image, 244 - width / 2, 362 - height / 2, width, height);
  } else {
    drawMascotFallback(ctx, 239, 357);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = colors.cinnabarPrimary; ctx.font = font(41); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(copyText(gamePack, 'title.board.heroName'), 210, 448);
  ctx.restore();
}

export function drawTitle(ctx, state, gamePack = gamePackFor(state, DEFAULT_GAME_PACK), host = null) {
  const config = gamePack.config;
  const colors = themeColors(gamePack);
  const tokens = presentationTokens(gamePack);
  drawPaper(ctx, gamePack, host);
  const reveal = Math.min(1, Math.max(0, (state.time || 0) / tokens.motion.titleRevealSeconds));
  drawInkBackdrop(ctx);
  ctx.save();
  drawMountainWash(ctx);

  drawAvatar(ctx, 35, 23, gamePack);
  drawCoinPill(ctx, 84, 27, Math.max(0, state.clearedStars || 0), gamePack);
  drawGear(ctx, 56, 91);
  drawEnergy(ctx, 88, 74, Math.min(25, Math.max(0, state.mantou ?? 25)), 30);

  ctx.fillStyle = colors.inkStrong; ctx.strokeStyle = 'rgba(255,250,239,0.72)'; ctx.lineWidth = 3;
  ctx.font = font(52); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = copyText(gamePack, 'game.title');
  ctx.strokeText(title, 210, 151); ctx.fillText(title, 210, 151);
  ctx.fillStyle = colors.cinnabarPrimary;
  ctx.fillRect(325, 139, 4, 24);
  ctx.fillStyle = colors.inkMuted; ctx.font = font(17);
  ctx.fillText(config.campaign.rank, 210, 186);
  drawStars(ctx, state.clearedStars || 0, 215, 27, gamePack);

  // 原来的双层“解锁”条幅是每帧常驻的假通知；这里改为唯一的关卡选择区。
  drawStageSelector(ctx, state, gamePack);

  ctx.save();
  ctx.globalAlpha = tokens.title.revealAlphaStart + reveal * (1 - tokens.title.revealAlphaStart);
  ctx.translate(0, (1 - reveal) * tokens.title.revealOffsetY);
  drawTitleBoard(ctx, state, gamePack, host);
  ctx.restore();

  drawCrossedBlades(ctx);
  drawStartButton(ctx, gamePack);
  drawRanking(ctx, gamePack);
  drawBackpack(ctx, gamePack);
  drawResetProgress(ctx, state, gamePack);

  ctx.fillStyle = 'rgba(73,57,40,0.76)'; ctx.font = font(13, false);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${state.stage?.name || config.campaign.stages[0].name} · 第 ${(state.stageIndex || 0) + 1} 关`, 210, 604);
  ctx.restore();
}
