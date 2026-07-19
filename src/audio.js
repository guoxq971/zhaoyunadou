// WebAudio 合成音效(无素材);首次交互后激活
let ac = null;

export function initAudio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
  }
  if (ac?.state === 'suspended') ac.resume();
}

function tone(freq, dur, type = 'sine', gain = 0.08, slide = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(freq + slide, 30), ac.currentTime + dur);
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + dur);
}

export function sfx(name) {
  if (!ac) return;
  switch (name) {
    case 'recruit': tone(520, 0.12, 'triangle', 0.1); tone(780, 0.15, 'triangle', 0.07); break;
    case 'place':   tone(300, 0.08, 'square', 0.05); break;
    case 'merge':   tone(440, 0.1, 'triangle', 0.1, 440); break;
    case 'hero':    tone(523, 0.15, 'triangle', 0.12); tone(659, 0.2, 'triangle', 0.1); tone(784, 0.3, 'triangle', 0.1); break;
    case 'fail':    tone(180, 0.15, 'sawtooth', 0.05, -80); break;
    case 'ult':     tone(220, 0.4, 'sawtooth', 0.08, -120); break;
  }
}
