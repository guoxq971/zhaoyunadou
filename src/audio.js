// WebAudio 合成音效；恢复失败会静默降级，并允许后续交互重试。
export function createAudioEngine(scope = globalThis) {
  let context = null;

  async function init() {
    if (!context) {
      const AudioContext = scope.AudioContext || scope.webkitAudioContext;
      if (!AudioContext) return false;
      try { context = new AudioContext(); } catch { context = null; }
    }
    if (!context) return false;
    if (context.state === 'suspended') {
      try { await context.resume(); } catch { return false; }
    }
    return context.state !== 'suspended';
  }

  function tone(freq, dur, type = 'sine', gain = 0.08, slide = 0) {
    if (!context || context.state === 'suspended') return;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, context.currentTime);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(freq + slide, 30), context.currentTime + dur);
    volume.gain.setValueAtTime(gain, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + dur);
    oscillator.connect(volume).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + dur);
  }

  function play(name) {
    switch (name) {
      case 'recruit': tone(520, 0.12, 'triangle', 0.1); tone(780, 0.15, 'triangle', 0.07); break;
      case 'place':   tone(300, 0.08, 'square', 0.05); break;
      case 'merge':   tone(440, 0.1, 'triangle', 0.1, 440); break;
      case 'hero':    tone(523, 0.15, 'triangle', 0.12); tone(659, 0.2, 'triangle', 0.1); tone(784, 0.3, 'triangle', 0.1); break;
      case 'fail':    tone(180, 0.15, 'sawtooth', 0.05, -80); break;
      case 'ult':     tone(220, 0.4, 'sawtooth', 0.08, -120); break;
    }
  }

  return { init, play };
}

const audio = createAudioEngine();
export const initAudio = () => audio.init();
export const sfx = (name) => audio.play(name);
