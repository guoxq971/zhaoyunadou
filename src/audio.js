const ignoreAsyncFailure = (value, onError) => {
  if (value && typeof value.then === 'function') value.catch(onError);
  return value;
};

// 所有 Host 音频错误都在这个边界被隔离，不得中断玩法。
export function createSafeAudioAdapter(adapter, onError = () => {}) {
  const call = (method, fallback, ...args) => {
    try {
      const value = adapter?.[method]?.(...args);
      return ignoreAsyncFailure(value, (error) => onError(error, `audio.${method}`)) ?? fallback;
    } catch (error) {
      onError(error, `audio.${method}`);
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
