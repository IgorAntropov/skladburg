import type { RootState } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';

import {
  Canvas,
  useThree,
} from '@react-three/fiber';
import {
  act,
  cleanup,
  render,
  waitFor,
} from '@testing-library/react';
import {
  StrictMode,
  useEffect,
} from 'react';
import { Vector3 } from 'three';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { NetworkSceneCityValue } from '../layout';

import { NetworkCityLabels } from './NetworkCityLabels';

const VIEWPORT_RECT = {
  bottom: 900,
  height: 900,
  left: 0,
  right: 1440,
  toJSON: (): string => '',
  top: 0,
  width: 1440,
  x: 0,
  y: 0,
};

const CITIES: readonly NetworkSceneCityValue[] = [
  ['Воронеж', -60, 18],
  ['Екатеринбург', 24, -6],
  ['Казань', -12, -6],
  ['Краснодар', -72, 42],
  ['Москва', -48, -6],
].map(([name, x, z], index) => ({
  cityId: `city-${String(index)}`,
  id: `node-${String(index)}`,
  name: String(name),
  radius: 6.4,
  x: Number(x),
  z: Number(z),
}));

class ImmediateResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  disconnect(): void {
    return undefined;
  }

  observe(target: Element): void {
    this.callback([{ contentRect: target.getBoundingClientRect() } as ResizeObserverEntry], this);
  }

  unobserve(): void {
    return undefined;
  }
}

const createFakeRenderer = (domElement: unknown): Record<string, unknown> => ({
  capabilities: {},
  dispose: (): void => undefined,
  domElement,
  extensions: {},
  forceContextLoss: (): void => undefined,
  getContext: (): Record<string, never> => ({}),
  info: { autoReset: true, reset: (): void => undefined },
  outputColorSpace: '',
  render: (): void => undefined,
  setClearColor: (): void => undefined,
  setPixelRatio: (): void => undefined,
  setSize: (): void => undefined,
  shadowMap: {},
  toneMapping: 0,
  xr: {
    addEventListener: (): void => undefined,
    enabled: false,
    removeEventListener: (): void => undefined,
    setPoseTarget: (): void => undefined,
  },
});

const readLabels = (container: HTMLElement): HTMLElement[] => {
  return Array.from(container.querySelectorAll<HTMLElement>('div.rounded-control'));
};

const renderLabels = async (isStrict: boolean): Promise<{ container: HTMLElement; state: () => RootState }> => {
  let latest: RootState | undefined;

  const Probe = (): null => {
    const get = useThree(current => current.get);

    useEffect(() => {
      latest = get();
    }, [get]);

    return null;
  };

  const scene = (
    <Canvas
      frameloop="never"
      gl={(defaultProps): never => createFakeRenderer(defaultProps.canvas) as never}
      orthographic
    >
      <Probe />
      <NetworkCityLabels cities={CITIES} />
    </Canvas>
  );

  const result = render(isStrict ? <StrictMode>{scene}</StrictMode> : scene);

  await waitFor(() => {
    expect(latest).toBeDefined();
  });

  return {
    container: result.container,
    state: (): RootState => {
      if (latest === undefined) {
        throw new Error('The canvas is not created');
      }

      return latest;
    },
  };
};

const drawFrame = (state: () => RootState, timestamp: number): void => {
  act(() => {
    state().advance(timestamp, true);
  });
};

describe('NetworkCityLabels', () => {
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

  it.each([false, true])('shows the label of every city when strict mode is %s', async (isStrict) => {
    const { container, state } = await renderLabels(isStrict);

    drawFrame(state, 100);

    expect(readLabels(container).map(label => label.textContent)).toEqual(CITIES.map(city => city.name));
  });

  it('moves the labels with the camera and hides the ones behind it', async () => {
    const { container, state } = await renderLabels(false);

    drawFrame(state, 100);

    const before = readLabels(container).map(label => label.style.transform);
    const camera = state().camera as OrthographicCamera;

    camera.position.set(60, 40, 60);
    camera.zoom = 6;
    camera.near = 0.1;
    camera.far = 1500;
    camera.updateProjectionMatrix();
    camera.lookAt(new Vector3(-10, 0, 0));

    drawFrame(state, 200);

    const after = readLabels(container);

    expect(after.map(label => label.style.transform)).not.toEqual(before);
    expect(after.every(label => label.style.display !== 'none')).toBe(true);

    camera.position.set(0, 0, 0);
    camera.lookAt(new Vector3(0, 0, -100));
    camera.far = 0.5;
    camera.updateProjectionMatrix();

    drawFrame(state, 300);

    expect(readLabels(container).every(label => label.style.display === 'none')).toBe(true);
  });

  it('removes the labels from the page on unmount', async () => {
    const { container, state } = await renderLabels(false);

    drawFrame(state, 100);
    cleanup();

    expect(readLabels(container)).toHaveLength(0);
  });
});

