/** Resolve after `ms`, or reject with the abort reason if `signal` aborts first. */
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Returns `reserveSlot(signal)`, which resolves when the caller may send its
 * request. Consecutive calls are spaced at least `minIntervalMs` apart, even
 * when fired in quick succession.
 */
export function createThrottle(minIntervalMs) {
  let nextFreeSlot = 0;

  return async function reserveSlot(signal) {
    const now = Date.now();
    const start = Math.max(now, nextFreeSlot);
    nextFreeSlot = start + minIntervalMs;
    if (start > now) await wait(start - now, signal);
  };
}
