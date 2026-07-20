import { addRing, addText } from '../effects.js';

// Theme 只选择现有的轻量反馈原语，不把新的玩法机制塞进配置。
export function addConfiguredFeedback(state, spec, {
  x,
  y,
  text = '',
  scale = 1,
  maxR = 60,
  life,
  delay,
  feedbackId,
} = {}) {
  const options = { life, delay, feedbackId };
  if (spec?.effectId === 'effect.ring') {
    addRing(state, x, y, spec.color, maxR, options);
    return 'ring';
  }
  if (spec?.effectId === 'effect.text') {
    addText(state, x, y, text, spec.color, scale, options);
    return 'text';
  }
  throw new Error(`[presentation] unsupported feedback effect "${spec?.effectId ?? 'missing'}"`);
}
