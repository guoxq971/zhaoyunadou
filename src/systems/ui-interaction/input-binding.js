import { subscribeGameCommands } from '../../engine-core/public.js';
import { createLocalInputMapper } from './input-mapper.js';

export function createLocalInputBinding(options = {}) {
  const { inputSource } = options;
  const mapper = createLocalInputMapper(options);
  let unsubscribe = null;
  let destroyed = false;

  function start() {
    if (destroyed || unsubscribe) return false;
    unsubscribe = subscribeGameCommands(inputSource, mapper.handle);
    return true;
  }

  function destroy() {
    if (destroyed) return false;
    mapper.cancel('controller-destroy');
    unsubscribe?.();
    unsubscribe = null;
    destroyed = true;
    return true;
  }

  return Object.freeze({ start, destroy });
}
