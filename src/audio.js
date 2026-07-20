// 所有 Host 音频错误都在这个边界被隔离，不得中断玩法。
export function createSafeAudioAdapter(adapter, onError = () => {}) {
  const report = (error, source) => {
    try { onError(error, source); } catch { /* 诊断失败也必须被隔离。 */ }
  };
  const call = (method, fallback, ...args) => {
    try {
      const value = adapter?.[method]?.(...args);
      if (value && typeof value.then === 'function') {
        return Promise.resolve(value).catch((error) => {
          report(error, `audio.${method}`);
          return fallback;
        });
      }
      return value ?? fallback;
    } catch (error) {
      report(error, `audio.${method}`);
      return fallback;
    }
  };
  return Object.freeze({
    init: () => call('init', false),
    play: (cueId) => call('play', false, cueId),
    pause: () => call('pause', undefined),
    resume: () => call('resume', undefined),
    setVolume: (value) => call('setVolume', undefined, value),
    destroy: () => call('destroy', undefined),
  });
}
