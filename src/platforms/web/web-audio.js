import { createAudioCueRegistry } from '../../presentation-pack/audio-cue-registry.js';

export function createWebAudioAdapter(scope, audioManifest) {
  const cues = createAudioCueRegistry(audioManifest);
  let context = null;
  let master = null;
  let volume = 1;

  async function init() {
    if (!context) {
      const Context = scope.AudioContext || scope.webkitAudioContext;
      if (!Context) return false;
      try {
        context = new Context();
        master = context.createGain?.() ?? null;
        if (master) {
          master.gain.value = volume;
          master.connect(context.destination);
        }
      } catch {
        context = null;
        master = null;
      }
    }
    if (!context) return false;
    if (context.state === 'suspended') {
      try { await context.resume(); } catch { return false; }
    }
    return context.state !== 'suspended';
  }

  function tone(voice) {
    if (!context || context.state === 'suspended') return;
    const frequency = voice.freq ?? voice.frequency;
    const duration = voice.dur ?? voice.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = voice.wave ?? voice.waveform ?? 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (voice.slide) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(frequency + voice.slide, 30),
        context.currentTime + duration,
      );
    }
    gain.gain.setValueAtTime(voice.gain ?? 0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(master ?? context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  function play(cueId) {
    try {
      if (!cues.has(cueId)) return false;
      for (const voice of cues.get(cueId).voices ?? cues.get(cueId).steps ?? []) tone(voice);
      return Boolean(context && context.state !== 'suspended');
    } catch { return false; }
  }

  async function pause() {
    try { if (context?.state === 'running') await context.suspend(); } catch { /* 无声降级 */ }
  }

  async function resume() {
    try { if (context?.state === 'suspended') await context.resume(); } catch { /* 下次手势重试 */ }
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (master) master.gain.value = volume;
  }

  async function destroy() {
    const previous = context;
    context = null;
    master = null;
    try { await previous?.close?.(); } catch { /* 已中断的实例不阻塞销毁 */ }
  }

  return Object.freeze({ init, play, pause, resume, setVolume, destroy });
}
