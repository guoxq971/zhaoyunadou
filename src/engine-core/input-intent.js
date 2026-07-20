const COMMAND_TYPES = Object.freeze({
  'pointer-down': 'pointer.begin',
  'pointer-move': 'pointer.move',
  'pointer-up': 'pointer.end',
  cancel: 'pointer.cancel',
  'key-down': 'key.press',
});

// Host 标准输入先转为 InputIntent；Controller 再据此生成会修改状态的 GameCommand。
export function gameCommandFromInput(event) {
  const type = COMMAND_TYPES[event?.type];
  if (!type) return null;
  if (event.type === 'key-down') {
    return Object.freeze({
      type,
      code: String(event.code ?? ''),
      repeat: Boolean(event.repeat),
      metaKey: Boolean(event.metaKey),
      ctrlKey: Boolean(event.ctrlKey),
      altKey: Boolean(event.altKey),
    });
  }
  if (event.type === 'cancel') {
    return Object.freeze({
      type,
      reason: String(event.reason ?? 'host-cancel'),
      // null 表示 blur/生命周期中断等全局取消；数字 ID 只取消对应触点。
      pointerId: event.pointerId ?? null,
    });
  }
  return Object.freeze({
    type,
    x: Number(event.x),
    y: Number(event.y),
    button: event.button,
    pointerId: event.pointerId ?? 0,
    pointerType: event.pointerType ?? 'unknown',
    primary: event.primary !== false,
  });
}

export function subscribeGameCommands(inputSource, listener) {
  if (typeof inputSource?.subscribe !== 'function') {
    throw new TypeError('[game-command] inputSource.subscribe() is required');
  }
  if (typeof listener !== 'function') throw new TypeError('[game-command] listener is required');
  return inputSource.subscribe((event) => {
    const command = gameCommandFromInput(event);
    return command ? listener(command) : false;
  });
}
