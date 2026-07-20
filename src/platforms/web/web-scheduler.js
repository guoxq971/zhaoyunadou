export function createWebScheduler(scope) {
  const logicTasks = new Set();
  const renderTasks = new Set();
  const now = () => Number(scope.performance?.now?.() ?? Date.now());

  function startLogicLoop(callback, intervalMs = 33) {
    const id = scope.setInterval(callback, intervalMs);
    logicTasks.add(id);
    return () => {
      if (!logicTasks.delete(id)) return;
      scope.clearInterval(id);
    };
  }

  function startRenderLoop(callback) {
    let active = true;
    let frameId = null;
    const frame = (time) => {
      if (!active) return;
      callback(time);
      if (active) frameId = scope.requestAnimationFrame(frame);
    };
    frameId = scope.requestAnimationFrame(frame);
    const cancel = () => {
      if (!active) return;
      active = false;
      if (frameId !== null) scope.cancelAnimationFrame(frameId);
      renderTasks.delete(cancel);
    };
    renderTasks.add(cancel);
    return cancel;
  }

  function cancelAll() {
    for (const id of [...logicTasks]) scope.clearInterval(id);
    logicTasks.clear();
    for (const cancel of [...renderTasks]) cancel();
    renderTasks.clear();
  }

  return Object.freeze({ now, startLogicLoop, startRenderLoop, cancelAll });
}
