export function createGameClock(now = () => performance.now()) {
  let last = now();
  return {
    reset() { last = now(); },
    next(speed = 1, hidden = false) {
      const current = now();
      const elapsed = Math.max(0, (current - last) / 1000);
      last = current;
      if (hidden) return 0;
      return Math.min(elapsed, 0.05) * Math.max(0, speed);
    },
  };
}
