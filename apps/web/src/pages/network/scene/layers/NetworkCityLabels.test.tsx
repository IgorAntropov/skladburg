import type { RootState } from '@react-three/fiber';
import type { ReactElement } from 'react';
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

import {
  createFakeRenderer,
  ImmediateResizeObserver,
  VIEWPORT_RECT,
} from './canvasTestSupport';
import { NetworkCityLabels } from './NetworkCityLabels';

const CITIES: readonly NetworkSceneCityValue[] = [
  ['Воронеж', -60, 18],
  ['Екатеринбург', 24, -6],
  ['Казань', -12, -6],
  ['Краснодар', -72, 42],
  ['Москва', -48, -6],
].map(([name, x, z], index) => ({
  cityId: `city-${String(index)}`,
  hiddenSiteIds: [],
  id: `node-${String(index)}`,
  name: String(name),
  radius: 6.4,
  x: Number(x),
  z: Number(z),
}));

const readLabels = (container: HTMLElement): HTMLElement[] => {
  return Array.from(container.querySelectorAll<HTMLElement>('div.rounded-control'));
};

interface LabelPropsValue {
  cities: readonly NetworkSceneCityValue[];
  hoveredId: string | undefined;
  selectedId: string | undefined;
}

const DEFAULT_PROPS: LabelPropsValue = { cities: CITIES, hoveredId: undefined, selectedId: undefined };

const renderLabels = async (
  isStrict: boolean,
  initial: LabelPropsValue = DEFAULT_PROPS,
): Promise<{ container: HTMLElement; state: () => RootState; update: (props: LabelPropsValue) => void }> => {
  let latest: RootState | undefined;

  const Probe = (): null => {
    const get = useThree(current => current.get);

    useEffect(() => {
      latest = get();
    }, [get]);

    return null;
  };

  const createScene = (props: LabelPropsValue): ReactElement => {
    const scene = (
      <Canvas
        frameloop="never"
        gl={(defaultProps): never => createFakeRenderer(defaultProps.canvas) as never}
        orthographic
      >
        <Probe />
        <NetworkCityLabels cities={props.cities} hoveredId={props.hoveredId} selectedId={props.selectedId} />
      </Canvas>
    );

    return isStrict ? <StrictMode>{scene}</StrictMode> : scene;
  };

  const result = render(createScene(initial));

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
    update: (props: LabelPropsValue): void => {
      act(() => {
        result.rerender(createScene(props));
      });
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

  it('marks every label with the test id and the id of its city', async () => {
    const { container, state } = await renderLabels(false);

    drawFrame(state, 100);

    const labels = readLabels(container);

    expect(labels.map(label => label.dataset.testid)).toEqual(CITIES.map(() => 'network-city-label'));
    expect(labels.map(label => label.dataset.cityId)).toEqual(CITIES.map(city => city.id));
  });

  it('shows no more badge for a city without hidden sites', async () => {
    const { container } = await renderLabels(false);

    expect(container.querySelector('[data-testid="network-city-label-more"]')).toBeNull();
  });

  it('shows the count of hidden sites in a separate badge after the name', async () => {
    const cities = CITIES.map((city, index) => (index === 2 ? { ...city, hiddenSiteIds: ['a', 'b', 'c'] } : city));
    const { container } = await renderLabels(false, { ...DEFAULT_PROPS, cities });

    const badges = container.querySelectorAll('[data-testid="network-city-label-more"]');
    const label = readLabels(container)[2];

    expect(badges).toHaveLength(1);
    expect(badges[0]?.textContent).toBe('+3');
    expect(label?.firstElementChild?.textContent).toBe('Казань');
    expect(label?.lastElementChild).toBe(badges[0]);
  });

  it('puts the hovered and the selected state on the labels and takes it away again', async () => {
    const { container, update } = await renderLabels(false);

    update({ ...DEFAULT_PROPS, hoveredId: 'node-1', selectedId: 'node-3' });

    const marked = readLabels(container).map(label => [label.dataset.hovered, label.dataset.selected]);

    expect(marked).toEqual([
      [undefined, undefined],
      ['true', undefined],
      [undefined, undefined],
      [undefined, 'true'],
      [undefined, undefined],
    ]);

    update(DEFAULT_PROPS);

    expect(readLabels(container).every(label => label.dataset.hovered === undefined && label.dataset.selected === undefined)).toBe(true);
  });

  it('selects the label of the city whose hidden site is selected', async () => {
    const cities = CITIES.map((city, index) => (index === 4 ? { ...city, hiddenSiteIds: ['hidden-site'] } : city));
    const { container } = await renderLabels(false, { cities, hoveredId: undefined, selectedId: 'hidden-site' });

    expect(readLabels(container).map(label => label.dataset.selected)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      'true',
    ]);
  });

  it('keeps the states when the labels are recreated for another list of cities', async () => {
    const { container, update } = await renderLabels(false, { ...DEFAULT_PROPS, selectedId: 'node-0' });

    update({ cities: CITIES.map(city => ({ ...city })), hoveredId: 'node-1', selectedId: 'node-0' });

    expect(readLabels(container).map(label => [label.dataset.hovered, label.dataset.selected])).toEqual([
      [undefined, 'true'],
      ['true', undefined],
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
    ]);
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

