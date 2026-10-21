export const VOID_COLOR = '#ff00ff';

export const VOID_COLOR_VARIABLE = '--world-background';

export const VOID_PROBE_TEST_ID = 'void-probe';

export const SCENE_LAYER_TEST_ID = 'hud-zone-scene';

export const HIDE_HUD_STYLE_ID = 'e2e-hide-hud';

export const VOID_SAMPLE_STEP_PX = 2;

export const VOID_MIN_RED_BLUE = 192;

export const VOID_MAX_GREEN = 64;

export const createVoidColorInitScript = (): string => `
(() => {
  const probe = { clearColor: null, matrices: new Map() };

  window.__voidProbe = probe;

  const applyVoidColor = () => {
    const root = document.documentElement;

    if (root === null) {
      return false;
    }

    root.style.setProperty(${JSON.stringify(VOID_COLOR_VARIABLE)}, ${JSON.stringify(VOID_COLOR)}, 'important');

    return true;
  };

  if (!applyVoidColor()) {
    const observer = new MutationObserver(() => {
      if (applyVoidColor()) {
        observer.disconnect();
      }
    });

    observer.observe(document, { childList: true });
  }

  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const originalClearColor = prototype.clearColor;
    const originalUniformMatrix = prototype.uniformMatrix4fv;

    prototype.clearColor = function recordedClearColor(red, green, blue, alpha) {
      probe.clearColor = [red, green, blue, alpha];

      return originalClearColor.call(this, red, green, blue, alpha);
    };

    prototype.uniformMatrix4fv = function recordedUniformMatrix(location, isTransposed, value, ...rest) {
      probe.matrices.set(location, Array.from(value).join(','));

      return originalUniformMatrix.call(this, location, isTransposed, value, ...rest);
    };
  }
})();
`;

export const READ_VOID_COLOR_SCRIPT = `
getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(VOID_COLOR_VARIABLE)}).trim().toLowerCase()
`;

export const READ_VIEW_SIGNATURE_SCRIPT = 'window.__voidProbe ? Array.from(window.__voidProbe.matrices.values()).join("|") : ""';

export const READ_CLEAR_COLOR_SCRIPT = 'window.__voidProbe ? window.__voidProbe.clearColor : null';

const HIDE_HUD_RULES = [
  'body * { visibility: hidden !important; }',
  `[data-testid="${SCENE_LAYER_TEST_ID}"], [data-testid="${SCENE_LAYER_TEST_ID}"] * { visibility: visible !important; }`,
].join(' ');

export const HIDE_HUD_SCRIPT = `
(() => {
  const style = document.createElement('style');

  style.id = ${JSON.stringify(HIDE_HUD_STYLE_ID)};
  style.textContent = ${JSON.stringify(HIDE_HUD_RULES)};
  document.head.append(style);
})()
`;

export const SHOW_HUD_SCRIPT = `
document.getElementById(${JSON.stringify(HIDE_HUD_STYLE_ID)})?.remove()
`;

export const ADD_VOID_PROBE_SCRIPT = `
(() => {
  const probe = document.createElement('div');

  probe.dataset.testid = ${JSON.stringify(VOID_PROBE_TEST_ID)};
  probe.style.cssText = 'position: fixed; left: 100px; top: 100px; width: 40px; height: 40px; background: ${VOID_COLOR};';
  document.querySelector('[data-testid="${SCENE_LAYER_TEST_ID}"]').append(probe);
})()
`;

export const REMOVE_VOID_PROBE_SCRIPT = `
document.querySelector('[data-testid="${VOID_PROBE_TEST_ID}"]')?.remove()
`;

export const createScanVoidPixelsScript = (base64: string): string => `
(async (base64) => {
  const image = new Image();

  image.src = 'data:image/png;base64,' + base64;
  await image.decode();

  const canvas = document.createElement('canvas');

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  context.drawImage(image, 0, 0);

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const samples = [];
  let voidCount = 0;

  for (let y = 0; y < height; y += ${String(VOID_SAMPLE_STEP_PX)}) {
    for (let x = 0; x < width; x += ${String(VOID_SAMPLE_STEP_PX)}) {
      const offset = (y * width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];

      if (red >= ${String(VOID_MIN_RED_BLUE)} && blue >= ${String(VOID_MIN_RED_BLUE)} && green <= ${String(VOID_MAX_GREEN)}) {
        voidCount += 1;

        if (samples.length < 5) {
          samples.push({ blue, green, red, x, y });
        }
      }
    }
  }

  return { height, samples, voidCount, width };
})(${JSON.stringify(base64)})
`;

export const GLOW_MIN_RED = 230;

export const GLOW_MIN_GREEN = 190;

export const GLOW_MAX_BLUE = 170;

export const WARM_SPOT_MIN_RED = 95;

export const WARM_SPOT_MAX_RED = 115;

export const WARM_SPOT_MIN_RED_MINUS_BLUE = 38;

export const WARM_SPOT_MIN_RED_MINUS_GREEN = 27;

export const createCountLightPixelsScript = (base64: string): string => `
(async (base64) => {
  const image = new Image();

  image.src = 'data:image/png;base64,' + base64;
  await image.decode();

  const canvas = document.createElement('canvas');

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  context.drawImage(image, 0, 0);

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let glowCount = 0;
  let warmSpotCount = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const isGlow = red >= ${String(GLOW_MIN_RED)}
      && green >= ${String(GLOW_MIN_GREEN)}
      && blue <= ${String(GLOW_MAX_BLUE)};
    const isWarmSpot = red >= ${String(WARM_SPOT_MIN_RED)}
      && red <= ${String(WARM_SPOT_MAX_RED)}
      && red - blue >= ${String(WARM_SPOT_MIN_RED_MINUS_BLUE)}
      && red - green >= ${String(WARM_SPOT_MIN_RED_MINUS_GREEN)};

    if (isGlow) {
      glowCount += 1;
    }

    if (isWarmSpot) {
      warmSpotCount += 1;
    }
  }

  return { glowCount, height, warmSpotCount, width };
})(${JSON.stringify(base64)})
`;
