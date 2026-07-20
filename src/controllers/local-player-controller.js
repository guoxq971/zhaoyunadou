import { CONTROLLER_API_VERSION, createCommandFactory } from '../engine-core/public.js';

// LocalPlayerController 只把 UI intent 封装为稳定 GameCommand 并提交；
// 平台订阅、命中测试、键盘落点与交互临时态均由 ui-interaction 负责。
export function createLocalPlayerController({
  dispatch,
  getTick = () => 0,
  getTime = () => 0,
  onSubmitted = () => {},
  actorId = 'local-player',
  side = 'player',
} = {}) {
  if (typeof dispatch !== 'function') throw new TypeError('[local-controller] dispatch is required');
  const commandFactory = createCommandFactory({ actorId, side, getTick, getTime });
  let started = false;
  let destroyed = false;

  function submit(type, payload = {}) {
    if (destroyed) return { ok: false, reason: 'controller-destroyed' };
    const command = commandFactory.create(type, payload);
    const result = dispatch(command);
    onSubmitted(command, result);
    return result;
  }

  function start() {
    if (destroyed || started) return false;
    started = true;
    return true;
  }

  function destroy() {
    if (destroyed) return false;
    started = false;
    destroyed = true;
    return true;
  }

  return Object.freeze({
    controllerApiVersion: CONTROLLER_API_VERSION,
    actorId,
    side,
    start,
    destroy,
    submit,
  });
}
