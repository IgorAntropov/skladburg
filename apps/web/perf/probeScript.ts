export const PROBE_GLOBAL_NAME = '__perfProbe';

export const READ_PROBE_SNAPSHOT_SCRIPT = `window.${PROBE_GLOBAL_NAME}.snapshot()`;

export const IS_PROBE_READY_SCRIPT = `window.${PROBE_GLOBAL_NAME} !== undefined && window.${PROBE_GLOBAL_NAME}.isReady()`;

export const IS_SCENE_DRAWN_SCRIPT = `window.${PROBE_GLOBAL_NAME} !== undefined && window.${PROBE_GLOBAL_NAME}.isSceneDrawn()`;

export interface ProbeOptionsValue {
  isSceneTracked: boolean;
}

export const createProbeScript = (options: ProbeOptionsValue): string => `
(() => {
  const options = ${JSON.stringify(options)};
  const sceneSelector = '[data-testid="hud-zone-scene"]';
  const state = {
    engineReadyAt: null,
    engineWorkerId: null,
    fcp: null,
    lcp: null,
    longTasks: [],
    messages: [],
    readyAt: null,
    sceneFirstFrameAt: null,
    skeletonShownAt: null,
    workerCreatedAt: null,
  };

  const isSkeletonShown = () => {
    const root = document.getElementById('root');

    return root !== null && root.firstElementChild !== null && root.querySelector(':scope > .boot-bar') === null;
  };

  const isInsideScene = (element) => element.closest(sceneSelector) !== null;

  const isReady = () => {
    if (!isSkeletonShown()) {
      return false;
    }

    if (document.querySelector('[data-testid="page-network"]') === null) {
      return false;
    }

    if (document.querySelector('[data-testid="hud-layout-skeleton"]') !== null) {
      return false;
    }

    const profileButton = document.querySelector('[data-testid="profile-button"]');

    if (profileButton === null || profileButton.getAttribute('aria-busy') === 'true') {
      return false;
    }

    const clockTime = document.querySelector('[data-testid="top-bar-clock-slot"] time');

    if (clockTime === null || !/\\d/.test(clockTime.textContent || '')) {
      return false;
    }

    return Array.from(document.querySelectorAll('[aria-busy="true"]')).every(isInsideScene);
  };

  const check = () => {
    const now = performance.now();

    if (state.skeletonShownAt === null && isSkeletonShown()) {
      state.skeletonShownAt = now;
    }

    if (state.readyAt === null && isReady()) {
      state.readyAt = now;
      observer.disconnect();
    }
  };

  const observer = new MutationObserver(check);

  observer.observe(document, {
    attributeFilter: ['aria-busy'],
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });

  const observeEntries = (type, handle) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(handle)).observe({ buffered: true, type });
    } catch (_error) {
      return;
    }
  };

  observeEntries('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') {
      state.fcp = entry.startTime;
    }
  });
  observeEntries('largest-contentful-paint', (entry) => {
    state.lcp = entry.startTime;
  });
  observeEntries('longtask', (entry) => {
    state.longTasks.push({ durationMs: entry.duration, startAt: entry.startTime });
  });

  const pickMessageFields = (data) => {
    const fields = {};

    if (typeof data !== 'object' || data === null) {
      fields.type = typeof data;

      return fields;
    }

    fields.type = typeof data.type === 'string' ? data.type : 'unknown';

    if (typeof data.url === 'string') {
      fields.url = data.url;
    }

    if (typeof data.command === 'string') {
      fields.command = data.command;
    }

    if (typeof data.requestId === 'string') {
      fields.requestId = data.requestId;
    }

    return fields;
  };

  const NativeWorker = window.Worker;
  const workerInfoByInstance = new WeakMap();
  let nextWorkerId = 0;

  const logMessage = (workerId, direction, at, data) => {
    state.messages.push({ at, direction, workerId, ...pickMessageFields(data) });
  };

  class ProbedWorker extends NativeWorker {
    constructor(scriptUrl, workerOptions) {
      super(scriptUrl, workerOptions);

      const info = { createdAt: performance.now(), workerId: nextWorkerId };

      nextWorkerId += 1;
      workerInfoByInstance.set(this, info);
      this.addEventListener('message', (event) => {
        const at = performance.now();

        if (state.engineWorkerId === null && event.data && event.data.type === 'status') {
          state.engineWorkerId = info.workerId;
          state.engineReadyAt = at;
          state.workerCreatedAt = info.createdAt;
        }

        logMessage(info.workerId, 'from-worker', at, event.data);
      });
    }

    postMessage(message, transfer) {
      const info = workerInfoByInstance.get(this);

      if (info !== undefined) {
        logMessage(info.workerId, 'to-worker', performance.now(), message);
      }

      return super.postMessage(message, transfer);
    }
  }

  window.Worker = ProbedWorker;

  if (options.isSceneTracked) {
    const drawMethodNames = ['drawArrays', 'drawArraysInstanced', 'drawElements', 'drawElementsInstanced', 'drawRangeElements'];

    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const methodName of drawMethodNames) {
        const original = prototype[methodName];

        if (typeof original === 'function') {
          prototype[methodName] = function trackedDraw(...args) {
            if (state.sceneFirstFrameAt === null) {
              state.sceneFirstFrameAt = performance.now();
            }

            return original.apply(this, args);
          };
        }
      }
    }
  }

  window.${PROBE_GLOBAL_NAME} = {
    isReady: () => state.readyAt !== null,
    isSceneDrawn: () => state.sceneFirstFrameAt !== null,
    snapshot: () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const engineMessages = state.engineWorkerId === null
        ? state.messages
        : state.messages.filter((message) => message.workerId === state.engineWorkerId);

      return {
        engineReadyAt: state.engineReadyAt,
        fcp: state.fcp,
        firstScreenReadyAt: state.readyAt,
        lcp: state.lcp,
        longTasks: state.longTasks,
        resources: performance.getEntriesByType('resource').map((entry) => ({
          encodedBodySize: entry.encodedBodySize,
          endAt: entry.responseEnd,
          startAt: entry.startTime,
          transferSize: entry.transferSize,
          url: entry.name,
        })),
        sceneFirstFrameAt: state.sceneFirstFrameAt,
        skeletonShownAt: state.skeletonShownAt,
        timeOrigin: performance.timeOrigin,
        ttfb: navigation ? navigation.responseStart : null,
        workerCreatedAt: state.workerCreatedAt,
        workerMessages: engineMessages.map(({ workerId, ...message }) => message),
      };
    },
  };

  check();
})();
`;
