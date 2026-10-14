import type { Mock } from 'vitest';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { CanvasFactory } from './createWebGlProbe';

import { createWebGlProbe } from './createWebGlProbe';

const UNMASKED_RENDERER_PARAMETER = 37446;
const RENDERER_PARAMETER = 7937;
const GENERIC_RENDERER_NAME = 'WebKit WebGL';
const SOFTWARE_NAME = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
const HARDWARE_NAME = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)';

interface FakeCanvasesOptionsValue {
  hasDebugInfo?: boolean;
  plainRenderer?: string;
  strictRenderer?: string;
  supportedTypes?: readonly string[];
}

interface FakeCanvasesValue {
  contextRequests: Mock<(type: string, isStrict: boolean) => void>;
  createCanvas: Mock<CanvasFactory>;
  loseContext: Mock<() => void>;
}

const createFakeCanvases = ({
  hasDebugInfo = true,
  plainRenderer,
  strictRenderer,
  supportedTypes = ['webgl2', 'webgl'],
}: FakeCanvasesOptionsValue): FakeCanvasesValue => {
  const loseContext = vi.fn();
  const contextRequests = vi.fn<(type: string, isStrict: boolean) => void>();

  const createContext = (rendererName: string): unknown => ({
    getExtension: (name: string): unknown => {
      if (name === 'WEBGL_lose_context') {
        return { loseContext };
      }

      return name === 'WEBGL_debug_renderer_info' && hasDebugInfo
        ? { UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER_PARAMETER }
        : null;
    },
    getParameter: (parameter: number): unknown => {
      if (parameter === UNMASKED_RENDERER_PARAMETER) {
        return rendererName;
      }

      return parameter === RENDERER_PARAMETER ? (hasDebugInfo ? GENERIC_RENDERER_NAME : rendererName) : undefined;
    },
    RENDERER: RENDERER_PARAMETER,
  });

  const createCanvas = vi.fn((): HTMLCanvasElement => {
    const getContext = (type: string, attributes: undefined | WebGLContextAttributes): unknown => {
      const isStrict = attributes?.failIfMajorPerformanceCaveat === true;
      const rendererName = isStrict ? strictRenderer : plainRenderer;

      contextRequests(type, isStrict);

      return rendererName === undefined || !supportedTypes.includes(type) ? null : createContext(rendererName);
    };

    return { getContext } as unknown as HTMLCanvasElement;
  });

  return { contextRequests, createCanvas, loseContext };
};

describe('createWebGlProbe', () => {
  it('reports hardware rendering when the strict context is created on a real GPU', () => {
    const fake = createFakeCanvases({ plainRenderer: HARDWARE_NAME, strictRenderer: HARDWARE_NAME });

    expect(createWebGlProbe(fake.createCanvas)()).toEqual({ isSoftware: false, isSupported: true });
    expect(fake.createCanvas).toHaveBeenCalledOnce();
    expect(fake.loseContext).toHaveBeenCalledOnce();
  });

  it('reports software rendering when the strict context is created but the renderer is a software one', () => {
    const fake = createFakeCanvases({ plainRenderer: SOFTWARE_NAME, strictRenderer: SOFTWARE_NAME });

    expect(createWebGlProbe(fake.createCanvas)()).toEqual({ isSoftware: true, isSupported: true });
    expect(fake.loseContext).toHaveBeenCalledOnce();
  });

  it('prefers the unmasked renderer name over the generic one', () => {
    const fake = createFakeCanvases({ strictRenderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' });

    expect(createWebGlProbe(fake.createCanvas)().isSoftware).toBe(true);
  });

  it('falls back to the generic renderer name when the debug extension is missing', () => {
    const software = createFakeCanvases({ hasDebugInfo: false, strictRenderer: 'Microsoft Basic Render Driver' });
    const hardware = createFakeCanvases({ hasDebugInfo: false, strictRenderer: 'Apple GPU' });

    expect(createWebGlProbe(software.createCanvas)().isSoftware).toBe(true);
    expect(createWebGlProbe(hardware.createCanvas)().isSoftware).toBe(false);
  });

  it('reports software rendering when only the context without the flag is created, and releases it', () => {
    const fake = createFakeCanvases({ plainRenderer: HARDWARE_NAME });

    expect(createWebGlProbe(fake.createCanvas)()).toEqual({ isSoftware: true, isSupported: true });
    expect(fake.createCanvas).toHaveBeenCalledTimes(2);
    expect(fake.loseContext).toHaveBeenCalledOnce();
  });

  it('asks for the strict context first and for the plain one after it', () => {
    const fake = createFakeCanvases({ plainRenderer: HARDWARE_NAME });

    createWebGlProbe(fake.createCanvas)();

    expect(fake.contextRequests.mock.calls).toEqual([
      ['webgl2', true],
      ['webgl', true],
      ['webgl2', false],
    ]);
  });

  it('falls back to WebGL 1', () => {
    const fake = createFakeCanvases({ strictRenderer: HARDWARE_NAME, supportedTypes: ['webgl'] });

    expect(createWebGlProbe(fake.createCanvas)()).toEqual({ isSoftware: false, isSupported: true });
    expect(fake.contextRequests.mock.calls).toEqual([
      ['webgl2', true],
      ['webgl', true],
    ]);
  });

  it('reports no WebGL when no context is created', () => {
    const fake = createFakeCanvases({});

    expect(createWebGlProbe(fake.createCanvas)()).toEqual({ isSoftware: false, isSupported: false });
    expect(fake.loseContext).not.toHaveBeenCalled();
  });

  it('reports no WebGL when the probe throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const createCanvas = vi.fn((): HTMLCanvasElement => {
      throw new Error('no canvas');
    });

    expect(createWebGlProbe(createCanvas)()).toEqual({ isSoftware: false, isSupported: false });
  });

  it('probes again after a negative result', () => {
    const fake = createFakeCanvases({});
    const probe = createWebGlProbe(fake.createCanvas);

    probe();
    probe();

    expect(fake.createCanvas).toHaveBeenCalledTimes(4);
  });

  it('keeps a positive result after later failures', () => {
    const working = createFakeCanvases({ strictRenderer: HARDWARE_NAME });
    const broken = createFakeCanvases({});
    const createCanvas = vi
      .fn<CanvasFactory>()
      .mockReturnValueOnce(working.createCanvas())
      .mockImplementation(broken.createCanvas);
    const probe = createWebGlProbe(createCanvas);

    expect(probe()).toEqual({ isSoftware: false, isSupported: true });
    expect(probe()).toEqual({ isSoftware: false, isSupported: true });
    expect(createCanvas).toHaveBeenCalledOnce();
  });

  it('keeps a positive software result as it is', () => {
    const fake = createFakeCanvases({ plainRenderer: HARDWARE_NAME });
    const probe = createWebGlProbe(fake.createCanvas);

    probe();
    probe();

    expect(fake.createCanvas).toHaveBeenCalledTimes(2);
    expect(probe()).toEqual({ isSoftware: true, isSupported: true });
  });
});
