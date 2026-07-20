// 本轮只定义平台端口；默认实现不访问账号、云端、支付或第三方分析服务。
export const NOOP_EVENT_SINK = Object.freeze({
  emit() {},
});

export function assertEventSink(value) {
  if (!value || typeof value.emit !== 'function') {
    throw new TypeError('event sink must expose emit(event)');
  }
  return value;
}

export const PLATFORM_PORTS = Object.freeze({
  analytics: 'EventSink',
  storage: 'KeyValueStorage',
  assets: 'AssetLoader',
  audio: 'AudioAdapter',
});
