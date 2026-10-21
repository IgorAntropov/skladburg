import type { ReactElement } from 'react';

import { Canvas } from '@react-three/fiber';
import {
  act,
  cleanup,
  render,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createFakeRenderer,
  ImmediateResizeObserver,
  VIEWPORT_RECT,
} from './canvasTestSupport';
import { useGlowProgramWarmup } from './useGlowProgramWarmup';

interface WarmupHandleValue {
  calls: string[];
  compileAsync: ReturnType<typeof vi.fn>;
  finishCompile: () => Promise<void>;
  programs: { getUniforms: ReturnType<typeof vi.fn> }[];
  unmount: () => void;
}

const renderWarmup = async (): Promise<WarmupHandleValue> => {
  const calls: string[] = [];
  let resolveCompile: () => void = () => undefined;
  const compileAsync = vi.fn(() => {
    calls.push('compile');

    return new Promise<void>((resolve) => {
      resolveCompile = resolve;
    });
  });
  const programs = [{ getUniforms: vi.fn() }, { getUniforms: vi.fn() }];

  const Layer = (): null => {
    useEffect(() => {
      calls.push('layer');
    }, []);

    return null;
  };

  const Scene = (): ReactElement => {
    useGlowProgramWarmup();

    return (
      <>
        <Layer />
      </>
    );
  };

  const result = render(
    <Canvas
      frameloop="never"
      gl={(defaultProps): never => ({
        ...createFakeRenderer(defaultProps.canvas),
        compileAsync,
        info: { autoReset: true, programs, reset: (): void => undefined },
      }) as never}
      orthographic
    >
      <Scene />
    </Canvas>,
  );

  await waitFor(() => {
    expect(compileAsync).toHaveBeenCalled();
  });

  return {
    calls,
    compileAsync,
    finishCompile: async (): Promise<void> => {
      await act(async () => {
        resolveCompile();
        await Promise.resolve();
      });
    },
    programs,
    unmount: (): void => {
      act(() => {
        result.unmount();
      });
    },
  };
};

describe('useGlowProgramWarmup', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(VIEWPORT_RECT);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('compiles the programs of the scene once, after the layers below it are mounted', async () => {
    const { calls, compileAsync } = await renderWarmup();

    expect(compileAsync).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['layer', 'compile']);
  });

  it('pays the first use of every compiled program right after the compile is ready', async () => {
    const { finishCompile, programs } = await renderWarmup();

    expect(programs[0]?.getUniforms).not.toHaveBeenCalled();
    expect(programs[1]?.getUniforms).not.toHaveBeenCalled();

    await finishCompile();

    expect(programs[0]?.getUniforms).toHaveBeenCalledTimes(1);
    expect(programs[1]?.getUniforms).toHaveBeenCalledTimes(1);
  });

  it('does not pay the programs when the scene unmounts before the compile is ready', async () => {
    const { finishCompile, programs, unmount } = await renderWarmup();

    unmount();
    await finishCompile();

    expect(programs[0]?.getUniforms).not.toHaveBeenCalled();
    expect(programs[1]?.getUniforms).not.toHaveBeenCalled();
  });
});
