import type { Mock } from 'vitest';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createWebGlProbe } from './createWebGlProbe';

interface FakeCanvasValue {
  canvas: HTMLCanvasElement;
  getContext: Mock<(type: string) => unknown>;
  loseContext: Mock<() => void>;
}

const createFakeCanvas = (contexts: Record<string, unknown>): FakeCanvasValue => {
  const loseContext = vi.fn();
  const context = { getExtension: vi.fn(() => ({ loseContext })) };
  const getContext = vi.fn((type: string) => (contexts[type] === undefined ? null : context));

  return { canvas: { getContext } as unknown as HTMLCanvasElement, getContext, loseContext };
};

describe('createWebGlProbe', () => {
  it('reports WebGL 2 and releases the probe context', () => {
    const fake = createFakeCanvas({ webgl2: true });

    expect(createWebGlProbe(() => fake.canvas)()).toBe(true);
    expect(fake.loseContext).toHaveBeenCalledOnce();
  });

  it('falls back to WebGL 1', () => {
    const fake = createFakeCanvas({ webgl: true });

    expect(createWebGlProbe(() => fake.canvas)()).toBe(true);
    expect(fake.getContext.mock.calls.map(([type]) => type)).toEqual(['webgl2', 'webgl']);
  });

  it('reports no WebGL when no context is created', () => {
    expect(createWebGlProbe(() => createFakeCanvas({}).canvas)()).toBe(false);
  });

  it('reports no WebGL when the probe throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const createCanvas = vi.fn((): HTMLCanvasElement => {
      throw new Error('no canvas');
    });

    expect(createWebGlProbe(createCanvas)()).toBe(false);
  });

  it('probes again after a negative result', () => {
    const fake = createFakeCanvas({});
    const createCanvas = vi.fn(() => fake.canvas);
    const isSupported = createWebGlProbe(createCanvas);

    isSupported();
    isSupported();

    expect(createCanvas).toHaveBeenCalledTimes(2);
  });

  it('keeps a positive result after later failures', () => {
    const workingCanvas = createFakeCanvas({ webgl2: true });
    const createCanvas = vi
      .fn<() => HTMLCanvasElement>()
      .mockReturnValueOnce(workingCanvas.canvas)
      .mockReturnValue(createFakeCanvas({}).canvas);
    const isSupported = createWebGlProbe(createCanvas);

    expect(isSupported()).toBe(true);
    expect(isSupported()).toBe(true);
    expect(createCanvas).toHaveBeenCalledOnce();
  });

  it('probes once per session after a positive result', () => {
    const fake = createFakeCanvas({ webgl2: true });
    const createCanvas = vi.fn(() => fake.canvas);
    const isSupported = createWebGlProbe(createCanvas);

    isSupported();
    isSupported();

    expect(createCanvas).toHaveBeenCalledOnce();
  });
});
