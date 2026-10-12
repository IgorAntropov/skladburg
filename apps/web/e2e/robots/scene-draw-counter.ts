export const DRAW_COUNTER_INIT_SCRIPT = `
(() => {
  const counter = { count: 0, lastAt: 0 };
  const methodNames = [
    'drawArrays',
    'drawArraysInstanced',
    'drawArraysInstancedANGLE',
    'drawElements',
    'drawElementsInstanced',
    'drawElementsInstancedANGLE',
    'drawRangeElements',
  ];
  const prototypes = [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype];

  window.__drawCounter = counter;

  for (const prototype of prototypes) {
    for (const methodName of methodNames) {
      const original = prototype[methodName];

      if (typeof original === 'function') {
        prototype[methodName] = function countedDraw(...args) {
          counter.count += 1;
          counter.lastAt = performance.now();

          return original.apply(this, args);
        };
      }
    }
  }
})();
`;

export const READ_DRAW_CALLS_SCRIPT = 'window.__drawCounter ? window.__drawCounter.count : 0';

export const createWaitForIdleScript = (idleWindowMs: number): string => `
new Promise((resolve) => {
  const check = () => {
    if (performance.now() - window.__drawCounter.lastAt >= ${String(idleWindowMs)}) {
      resolve();
    }
    else {
      setTimeout(check, 100);
    }
  };

  check();
})
`;

export const createSleepScript = (durationMs: number): string => `new Promise((resolve) => setTimeout(resolve, ${String(durationMs)}))`;
