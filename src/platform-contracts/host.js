// Host 是 app-shell 与具体宿主之间的唯一能力契约。
export const ADAPTER_API_VERSION = '1.0.0';
export const CAPABILITY_STATES = Object.freeze(['supported', 'degraded', 'unsupported']);
export const REQUIRED_CAPABILITIES = Object.freeze([
  'surface', 'scheduler', 'lifecycle', 'input',
  'storage', 'assets', 'audio', 'deviceInfo',
]);

const REQUIRED_METHODS = Object.freeze({
  surface: [
    'getMainCanvas', 'getContext', 'getViewport', 'fit', 'focus',
    'createOffscreenCanvas', 'createImage', 'setStateDataset',
    'setAccessibleStatus', 'subscribeViewport',
  ],
  scheduler: ['now', 'startLogicLoop', 'startRenderLoop', 'cancelAll'],
  lifecycle: ['getState', 'subscribe'],
  input: ['subscribe'],
  storage: ['getItem', 'setItem', 'removeItem'],
  assets: ['resolvePath', 'loadImage', 'status', 'destroy'],
  audio: ['init', 'play', 'pause', 'resume', 'setVolume', 'destroy'],
  device: ['getInfo'],
});

function assertMethods(host, port, methods) {
  const adapter = host?.[port];
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError(`[host] ${port} (${port[0].toUpperCase()}${port.slice(1)}) adapter is required`);
  }
  for (const method of methods) {
    if (typeof adapter[method] !== 'function') {
      throw new TypeError(`[host] ${port}.${method}() is required`);
    }
  }
}

export function assertHostContract(host, { adapterApiVersion = ADAPTER_API_VERSION } = {}) {
  if (!host || typeof host !== 'object') throw new TypeError('[host] host object is required');
  if (host.adapterApiVersion !== adapterApiVersion) {
    throw new Error(`[host] adapterApiVersion ${adapterApiVersion} required, got ${String(host.adapterApiVersion)}`);
  }
  if (!host.capabilities || typeof host.capabilities !== 'object') {
    throw new TypeError('[host] capabilities are required');
  }
  for (const id of REQUIRED_CAPABILITIES) {
    if (!(id in host.capabilities)) throw new Error(`[host] capability ${id} is required`);
  }
  for (const [id, state] of Object.entries(host.capabilities)) {
    if (!CAPABILITY_STATES.includes(state)) {
      throw new Error(`[host] capability ${id} has invalid state "${String(state)}"`);
    }
  }
  for (const [port, methods] of Object.entries(REQUIRED_METHODS)) assertMethods(host, port, methods);
  if (typeof host.storage.persistent !== 'boolean') {
    throw new TypeError('[host] storage.persistent must be a boolean');
  }
  return host;
}

export function capabilitySupported(host, id) {
  return host?.capabilities?.[id] === 'supported';
}
