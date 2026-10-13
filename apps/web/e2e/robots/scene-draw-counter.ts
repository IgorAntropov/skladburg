export const DRAW_COUNTER_INIT_SCRIPT = `
(() => {
  const counter = { count: 0, frames: 0, inputAt: 0, isInFrame: false, lastAt: 0, longTasks: [], markAt: 0, prevFrameAt: 0, simMs: 0 };
  const maxFrameStepMs = 1000 / 30;
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

          if (!counter.isInFrame) {
            counter.isInFrame = true;
            counter.frames += 1;
            counter.simMs += Math.min(counter.lastAt - counter.prevFrameAt, maxFrameStepMs);
            counter.prevFrameAt = counter.lastAt;
            queueMicrotask(() => {
              counter.isInFrame = false;
            });
          }

          return original.apply(this, args);
        };
      }
    }
  }

  const pendingFrameIds = new Set();
  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

  counter.countPendingFrames = () => pendingFrameIds.size;

  window.requestAnimationFrame = (callback) => {
    const id = originalRequestAnimationFrame((time) => {
      pendingFrameIds.delete(id);
      callback(time);
    });

    pendingFrameIds.add(id);

    return id;
  };

  window.cancelAnimationFrame = (id) => {
    pendingFrameIds.delete(id);
    originalCancelAnimationFrame(id);
  };

  const stampInput = () => {
    counter.inputAt = performance.now();
  };

  window.addEventListener('click', stampInput, true);
  window.addEventListener('keydown', stampInput, true);

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        counter.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
      }
    }).observe({ buffered: true, type: 'longtask' });
  }
  catch {
    counter.longTasks = [];
  }
})();
`;

export const READ_DRAW_CALLS_SCRIPT = 'window.__drawCounter ? window.__drawCounter.count : 0';

export const READ_DRAW_FRAMES_SCRIPT = 'window.__drawCounter ? window.__drawCounter.frames : 0';

export const MARK_MOTION_START_SCRIPT = `
(() => {
  window.__drawCounter.markAt = performance.now();
  window.__drawCounter.simMs = 0;
})()
`;

export const READ_ANIMATION_MS_SCRIPT = 'window.__drawCounter.simMs';

export const READ_SETTLE_OFFSET_SCRIPT = 'window.__drawCounter.lastAt - window.__drawCounter.inputAt';

export const READ_LONG_TASK_DURATIONS_SCRIPT = `
window.__drawCounter.longTasks
  .filter((task) => task.startTime >= window.__drawCounter.markAt && task.duration > 50)
  .map((task) => task.duration)
`;

export const createWaitForIdleScript = (idleWindowMs: number): string => `
new Promise((resolve) => {
  const check = () => {
    const counter = window.__drawCounter;

    if (performance.now() - counter.lastAt >= ${String(idleWindowMs)} && counter.countPendingFrames() === 0) {
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
