export function createWebInputSource(scope, surface) {
  const subscriptions = new Set();

  function point(event) {
    const rect = surface.getMainCanvas().getBoundingClientRect();
    const logical = surface.getLogicalSize();
    return {
      x: (Number(event.clientX) - rect.left) / rect.width * logical.width,
      y: (Number(event.clientY) - rect.top) / rect.height * logical.height,
    };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('[web-input] listener is required');
    const canvas = surface.getMainCanvas();
    const emitPointer = (type, event) => {
      if (type === 'pointer-down') surface.focus();
      const handled = listener({
        type,
        ...point(event),
        button: event.button,
        pointerId: event.pointerId ?? 0,
        pointerType: event.pointerType ?? 'mouse',
        primary: event.isPrimary !== false,
      });
      if (handled) event.preventDefault?.();
      return handled;
    };
    const onDown = (event) => emitPointer('pointer-down', event);
    const onMove = (event) => emitPointer('pointer-move', event);
    const onUp = (event) => emitPointer('pointer-up', event);
    const onCancel = (event) => listener({
      type: 'cancel',
      reason: 'pointer-cancel',
      pointerId: event?.pointerId ?? null,
    });
    const onBlur = () => listener({ type: 'cancel', reason: 'blur' });
    const onKeyDown = (event) => {
      const handled = listener({
        type: 'key-down',
        code: event.code,
        repeat: Boolean(event.repeat),
        metaKey: Boolean(event.metaKey),
        ctrlKey: Boolean(event.ctrlKey),
        altKey: Boolean(event.altKey),
      });
      if (handled) event.preventDefault?.();
    };
    const removals = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener?.(type, handler, options);
      removals.push(() => target.removeEventListener?.(type, handler, options));
    };
    try {
      if (typeof scope.PointerEvent === 'function') {
        listen(canvas, 'pointerdown', onDown);
        listen(canvas, 'pointermove', onMove);
        listen(scope, 'pointerup', onUp);
        listen(scope, 'pointercancel', onCancel);
      } else {
      // 旧 WebView 没有 PointerEvent 时才启用 Touch+Mouse，避免一次触摸触发两套事件。
      let ignoreMouseUntil = -Infinity;
      let activeTouchId = null;
      const now = () => Number(scope.performance?.now?.() ?? Date.now());
      const fromTouch = (touch, original) => ({
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        pointerId: touch.identifier ?? 0,
        pointerType: 'touch',
        isPrimary: true,
        preventDefault: () => original.preventDefault?.(),
      });
      const touchWithId = (list, id) => [...(list ?? [])].find((touch) => touch.identifier === id);
      const onTouchStart = (event) => {
        if (activeTouchId !== null) return;
        const touch = event.changedTouches?.[0] ?? event.touches?.[0];
        if (!touch) return;
        activeTouchId = touch.identifier ?? 0;
        ignoreMouseUntil = now() + 800;
        emitPointer('pointer-down', fromTouch(touch, event));
      };
      const onTouchMove = (event) => {
        const touch = touchWithId(event.touches, activeTouchId);
        if (touch) emitPointer('pointer-move', fromTouch(touch, event));
      };
      const onTouchEnd = (event) => {
        const touch = touchWithId(event.changedTouches, activeTouchId);
        if (!touch) return;
        emitPointer('pointer-up', fromTouch(touch, event));
        activeTouchId = null;
      };
      const onTouchCancel = (event) => {
        if (activeTouchId === null) return;
        const touch = touchWithId(event.changedTouches, activeTouchId);
        if (event.changedTouches?.length && !touch) return;
        const pointerId = activeTouchId;
        event.preventDefault?.();
        activeTouchId = null;
        onCancel({ pointerId });
      };
      const onMouseDown = (event) => {
        if (now() >= ignoreMouseUntil) onDown(event);
      };
      const onMouseMove = (event) => {
        if (now() >= ignoreMouseUntil) onMove(event);
      };
      const onMouseUp = (event) => {
        if (now() >= ignoreMouseUntil) onUp(event);
      };
      listen(canvas, 'touchstart', onTouchStart, { passive: false });
      listen(canvas, 'touchmove', onTouchMove, { passive: false });
      listen(scope, 'touchend', onTouchEnd, { passive: false });
      listen(scope, 'touchcancel', onTouchCancel, { passive: false });
      listen(canvas, 'mousedown', onMouseDown);
      listen(canvas, 'mousemove', onMouseMove);
        listen(scope, 'mouseup', onMouseUp);
      }
      listen(scope, 'blur', onBlur);
      listen(scope, 'keydown', onKeyDown);
    } catch (error) {
      // subscribe 必须原子化：中途注册失败时撤销已安装的所有监听器。
      for (const remove of removals.splice(0).reverse()) {
        try { remove(); } catch { /* 继续撤销其他监听器。 */ }
      }
      throw error;
    }
    const unsubscribe = () => {
      for (const remove of removals.splice(0).reverse()) remove();
    };
    subscriptions.add(unsubscribe);
    return () => {
      if (!subscriptions.delete(unsubscribe)) return;
      unsubscribe();
    };
  }

  function destroy() {
    for (const unsubscribe of [...subscriptions]) unsubscribe();
    subscriptions.clear();
  }

  return Object.freeze({ subscribe, destroy });
}
