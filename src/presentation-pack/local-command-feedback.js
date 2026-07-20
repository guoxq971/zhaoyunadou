import { copyText } from '../engine-core/public.js';
import { addRing, addText } from '../effects.js';
import { B, UI, benchRect, cellXY } from '../ui-layout.js';
import { presentationTokens, themeColors } from '../render-theme.js';
import { addConfiguredFeedback } from './feedback-effect.js';

const FAILURE_LABELS = Object.freeze({
  'bench-full': '营栏已满',
  'insufficient-mantou': '馒头不足',
  'drag-active': '请先放下字牌',
  'target-not-open': '此处不可部署',
  'target-not-movable': '固定目标不可交换',
  'invalid-target': '落点无效',
  'same-location': '仍在原位',
  'source-changed': '原位已变化',
  'target-not-locked': '这里只能铲封地',
  'tool-unavailable': '道具不足',
});

function targetPoint(target) {
  if (target?.zone === 'grid') return cellXY(target.r, target.c);
  if (target?.zone === 'bench') {
    const rect = benchRect(target.index);
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }
  return { x: 210, y: UI.recruit.y - 14 };
}

export function createLocalCommandFeedback({ game, gamePack, audioEngine }) {
  const copy = (id, values, fallback) => copyText(gamePack, id, values, fallback);
  const colors = themeColors(gamePack);
  const feedback = gamePack.manifests.theme.feedback;
  const { motion } = presentationTokens(gamePack);
  const sfx = (cueId) => audioEngine?.play?.(cueId);

  return function presentCommand(command, result) {
    const state = game.state;
    if (command.type === 'battle.batch_recruit') {
      if (result.ok) {
        for (const [index, recruit] of (result.results ?? []).entries()) {
          const rect = benchRect(recruit.slot);
          const x = rect.x + rect.w / 2;
          const y = rect.y + rect.h / 2;
          const delay = index * motion.batchStepSeconds;
          addConfiguredFeedback(state, feedback.recruit, {
            x, y, maxR: 30,
            delay, life: motion.feedbackSeconds, feedbackId: 'recruit-seal',
          });
          addText(state, x, y, '募', colors.cinnabarPrimary, 0.8, {
            delay, life: motion.feedbackSeconds, feedbackId: 'recruit-mark',
          });
        }
        addText(state, 210, UI.recruit.y - 14, copy('battle.recruit.batchResult', {
          count: result.filledCount, cost: result.totalCost,
        }, `征得 ${result.filledCount} · 耗 ${result.totalCost}`), colors.cinnabarPrimary, 1.25);
        sfx('recruit');
      } else {
        addText(state, 210, UI.recruit.y - 14, FAILURE_LABELS[result.reason] ?? '征兵未成', colors.invalidTarget, 1.05);
        sfx('fail');
      }
      return;
    }

    if (command.type === 'unit.drop') {
      const point = targetPoint(command.payload.target);
      const sourcePoint = targetPoint(command.payload.source);
      if (!result.ok) {
        addRing(state, point.x, point.y, colors.invalidTarget, 38, {
          life: motion.invalidReboundSeconds, feedbackId: 'invalid-target',
        });
        addRing(state, sourcePoint.x, sourcePoint.y, colors.invalidTarget, 28, {
          delay: 0.06, life: motion.invalidReboundSeconds, feedbackId: 'invalid-rebound',
        });
        addConfiguredFeedback(state, feedback.invalid_action, {
          x: point.x,
          y: point.y - 22,
          text: FAILURE_LABELS[result.reason] ?? '不可落子',
          scale: 0.95,
          feedbackId: 'invalid-label',
        });
        sfx('fail');
        return;
      }
      const style = result.action === 'merge'
        ? { color: colors.goldReward, label: '合', cue: 'merge', radius: 48 }
        : result.action === 'swap'
          ? { color: colors.qingPlayable, label: '换', cue: 'place', radius: 44 }
          : { color: colors.qingPlayable, label: '移', cue: 'place', radius: 38 };
      if (result.action === 'swap') {
        addRing(state, sourcePoint.x, sourcePoint.y, style.color, 36, {
          life: motion.feedbackSeconds, feedbackId: 'swap-source',
        });
      }
      addConfiguredFeedback(state, feedback[result.action === 'merge' ? 'merge' : 'deploy'], {
        x: point.x,
        y: point.y,
        maxR: style.radius,
        life: motion.feedbackSeconds,
        feedbackId: `${result.action}-target`,
      });
      addText(state, point.x, point.y - 22, style.label, style.color, 0.8);
      sfx(style.cue);
      if (result.heroUnlocked) {
        const hero = gamePack.config.heroes[result.heroUnlocked];
        const heroPoint = cellXY(result.heroCell.r, result.heroCell.c);
        addConfiguredFeedback(state, feedback.hero_unlock, {
          x: heroPoint.x + B.cellW / 2,
          y: heroPoint.y,
          maxR: 120,
          life: motion.feedbackSeconds,
          feedbackId: 'hero-unlock',
        });
        addText(state, heroPoint.x + B.cellW / 2, heroPoint.y - 30, copy('battle.hero.join', {
          heroName: hero.name,
        }, `${hero.name} 参战!`), colors.cinnabarPrimary, 1.5);
        sfx('hero');
      }
      return;
    }

    if (command.type === 'item.use') {
      const point = targetPoint(command.payload.target);
      if (!result.ok) {
        addRing(state, point.x, point.y, colors.invalidTarget, 38);
        addText(state, point.x, point.y - 20, FAILURE_LABELS[result.reason] ?? '道具无效', colors.invalidTarget, 0.9);
        sfx('fail');
      } else if (result.itemId === 'shovel') {
        addRing(state, point.x, point.y, colors.qingPlayable, 52);
        addText(state, point.x, point.y - 20, copy('battle.deploy.openLand', {}, '开地'), colors.qingPlayable, 0.95);
        sfx('place');
      } else {
        addRing(state, point.x, point.y, colors.inkStructure, 54);
        addText(state, point.x, point.y - 20, copy('battle.brush.result', {
          char: result.char,
        }, `改作「${result.char}」`), colors.inkStructure, 1.05);
        sfx(result.heroUnlocked ? 'hero' : 'place');
      }
      return;
    }

    if (!result.ok) sfx('fail');
    else if (command.type.startsWith('campaign.') || command.type === 'result.resolve') sfx('place');
  };
}
