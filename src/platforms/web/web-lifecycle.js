export function createWebLifecycle(scope) {
  const subscriptions = new Set();
  const getState = () => (scope.document?.hidden ? 'background' : 'foreground');

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('[web-lifecycle] listener is required');
    const onVisibility = () => listener({
      type: scope.document.hidden ? 'background' : 'foreground',
      reason: 'visibility-change',
    });
    // BFCache 的 pagehide 不是退出；pageshow 后必须恢复同一应用实例。
    const onPageHide = (event) => listener({
      type: event?.persisted ? 'background' : 'exit',
      reason: event?.persisted ? 'pagehide-bfcache' : 'pagehide',
    });
    const onPageShow = (event) => {
      if (event?.persisted) listener({ type: 'foreground', reason: 'pageshow-bfcache' });
    };
    scope.document?.addEventListener?.('visibilitychange', onVisibility);
    scope.addEventListener?.('pagehide', onPageHide);
    scope.addEventListener?.('pageshow', onPageShow);
    const unsubscribe = () => {
      scope.document?.removeEventListener?.('visibilitychange', onVisibility);
      scope.removeEventListener?.('pagehide', onPageHide);
      scope.removeEventListener?.('pageshow', onPageShow);
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

  return Object.freeze({ getState, subscribe, destroy });
}
