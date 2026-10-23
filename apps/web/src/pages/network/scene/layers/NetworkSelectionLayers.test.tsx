import type { RootState } from '@react-three/fiber';
import type { ReactElement } from 'react';
import type { Mock } from 'vitest';

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
import { useEffect } from 'react';
import {
  BoxGeometry,
  InstancedMesh,
  MeshBasicMaterial,
} from 'three';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  readWorldPalette,
  WorldMaterialsProvider,
} from '@/shared/3d';

import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import {
  createFakeRenderer,
  ImmediateResizeObserver,
  VIEWPORT_RECT,
} from './canvasTestSupport';
import { NetworkSelectionCorners } from './NetworkSelectionCorners';
import { NetworkSiteChips } from './NetworkSiteChips';

interface LayersPropsValue {
  hoveredId: string | undefined;
  hoveredSiteIds: readonly string[];
  selectedIds: readonly string[];
}

const createProps = (overrides: Partial<LayersPropsValue>): LayersPropsValue => ({
  hoveredId: undefined,
  hoveredSiteIds: [],
  selectedIds: [],
  ...overrides,
});

const PALETTE = readWorldPalette(() => '#808080');

const CITY: NetworkSceneCityValue = {
  cityId: 'moscow',
  hiddenSiteIds: ['hidden'],
  id: 'city',
  name: 'Москва',
  radius: 6.4,
  tier: 'medium',
  x: 0,
  z: 0,
};

const createWarehouse = (id: string, isOwn: boolean, x: number, side: 'customer' | 'supplier'): NetworkSceneBuildingValue => ({
  cityId: 'city',
  depth: 1.5,
  height: 1.5,
  id,
  isCompany: true,
  isOwn,
  kind: 'warehouse',
  rank: 0,
  rotation: 0,
  side,
  siteId: id,
  width: 2,
  x,
  z: 0,
});

const BUILDINGS = [createWarehouse('own', true, -3.2, 'customer'), createWarehouse('other', false, 3.2, 'supplier')];

interface MeshReadingValue {
  array: ArrayLike<number>;
  count: number;
}

const readMeshes = (state: RootState): MeshReadingValue[] => {
  const meshes: MeshReadingValue[] = [];

  state.scene.traverse((object) => {
    if (object instanceof InstancedMesh) {
      meshes.push({ array: object.instanceMatrix.array, count: object.count });
    }
  });

  return meshes;
};

const renderLayers = async (
  initial: LayersPropsValue,
): Promise<{ invalidate: Mock; state: () => RootState; update: (props: LayersPropsValue) => void }> => {
  let latest: RootState | undefined;
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const invalidate = vi.fn();

  const Probe = (): null => {
    const get = useThree(current => current.get);
    const set = useThree(current => current.set);

    useEffect(() => {
      set({ invalidate });
      latest = get();
    }, [get, set]);

    return null;
  };

  const createScene = (props: LayersPropsValue): ReactElement => (
    <Canvas
      frameloop="never"
      gl={(defaultProps): never => createFakeRenderer(defaultProps.canvas) as never}
      orthographic
    >
      <Probe />
      <WorldMaterialsProvider palette={PALETTE}>
        <NetworkSiteChips
          boxGeometry={boxGeometry}
          buildings={BUILDINGS}
          hoveredId={props.hoveredId}
          hoveredSiteIds={props.hoveredSiteIds}
        />
        <NetworkSelectionCorners
          boxGeometry={boxGeometry}
          buildings={BUILDINGS}
          cities={[CITY]}
          selectedIds={props.selectedIds}
        />
      </WorldMaterialsProvider>
    </Canvas>
  );

  const result = render(createScene(initial));

  await waitFor(() => {
    expect(latest).toBeDefined();
  });

  return {
    invalidate,
    state: (): RootState => {
      if (latest === undefined) {
        throw new Error('The canvas is not created');
      }

      return latest;
    },
    update: (props: LayersPropsValue): void => {
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

const readMaterials = (state: RootState): unknown[] => {
  const materials: unknown[] = [];

  state.scene.traverse((object) => {
    if (object instanceof InstancedMesh) {
      materials.push(object.material);
    }
  });

  return materials;
};

const readCornerMeshes = (state: RootState): MeshReadingValue[] => readMeshes(state).filter(mesh => mesh.count === 8);

const readCornerReach = (mesh: MeshReadingValue | undefined): number => {
  const array = mesh?.array ?? [];
  let reach = 0;

  for (let index = 0; index < 8; index += 1) {
    reach = Math.max(reach, Math.abs(array[index * 16 + 12] ?? 0));
  }

  return reach;
};

describe('selection and own site layers', () => {
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

  it('draws the chips, the posts, the house marks and the corners with materials that no light touches', async () => {
    const { state } = await renderLayers(createProps({ selectedIds: ['own'] }));
    const materials = readMaterials(state());

    expect(materials).toHaveLength(readMeshes(state()).length);
    expect(materials.length).toBeGreaterThanOrEqual(9);

    for (const material of materials) {
      expect(material).toBeInstanceOf(MeshBasicMaterial);
      expect(material).toMatchObject({ transparent: false, visible: true });
    }
  });

  it('draws no corners while nothing is selected', async () => {
    const { state } = await renderLayers(createProps({}));

    expect(readCornerMeshes(state())).toHaveLength(0);
  });

  it('draws two layers of eight bars for a selected site, a hidden site and a city, and none for an unknown id', async () => {
    const { state, update } = await renderLayers(createProps({ selectedIds: ['own'] }));

    expect(readCornerMeshes(state())).toHaveLength(2);

    update(createProps({ selectedIds: ['hidden'] }));
    expect(readCornerMeshes(state())).toHaveLength(2);

    update(createProps({ selectedIds: ['city'] }));
    expect(readCornerMeshes(state())).toHaveLength(2);

    update(createProps({ selectedIds: ['nobody'] }));
    expect(readCornerMeshes(state())).toHaveLength(0);
  });

  it('brings the corners in over 140 ms and then stops asking for frames', async () => {
    const { invalidate, state } = await renderLayers(createProps({ selectedIds: ['own'] }));
    const light = (): MeshReadingValue | undefined => readCornerMeshes(state())[1];
    const startReach = readCornerReach(light());

    drawFrame(state, 1000);
    drawFrame(state, 1016);
    drawFrame(state, 1032);

    const callsWhileMoving = invalidate.mock.calls.length;
    const middleReach = readCornerReach(light());

    for (let frame = 0; frame < 12; frame += 1) {
      drawFrame(state, 1048 + frame * 16);
    }

    const endReach = readCornerReach(light());
    const callsBefore = invalidate.mock.calls.length;

    drawFrame(state, 2000);
    drawFrame(state, 2016);

    expect(callsWhileMoving).toBeGreaterThanOrEqual(3);
    expect(middleReach).toBeLessThan(startReach);
    expect(endReach).toBeLessThan(middleReach);
    expect(endReach).toBeCloseTo(4.85, 3);
    expect(invalidate.mock.calls.length).toBe(callsBefore);
  });

  it('puts the corners on the place at once when the motion is reduced', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));

    const { invalidate, state } = await renderLayers(createProps({ selectedIds: ['own'] }));
    const light = readCornerMeshes(state())[1];

    invalidate.mockClear();
    drawFrame(state, 1000);
    drawFrame(state, 1016);

    expect(readCornerReach(light)).toBeCloseTo(4.85, 3);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('gives a house mark only to the chip of an own site', async () => {
    const { state } = await renderLayers(createProps({}));
    const meshes = readMeshes(state());

    expect(meshes.filter(mesh => mesh.count === 1)).toHaveLength(6);
    expect(meshes.filter(mesh => mesh.count === 2)).toHaveLength(1);
  });

  it('grows the hovered chip with its mark, lifts it and puts it back', async () => {
    const { state, update } = await renderLayers(createProps({}));
    const readHeights = (): number[] => readMeshes(state())
      .filter(mesh => mesh.count === 1)
      .map(mesh => mesh.array[13] ?? 0);
    const countNear = (heights: readonly number[], target: number): number => (
      heights.filter(value => Math.abs(value - target) < 0.01).length
    );
    const calmMark = 3.7 + 1.05 * Math.sqrt(1.5);
    const liftedMark = 4.1 + 1.05 * 1.25 * Math.sqrt(1.5);

    expect(countNear(readHeights(), 3.7)).toBe(4);
    expect(countNear(readHeights(), calmMark)).toBe(2);

    update(createProps({ hoveredId: 'own' }));
    expect(countNear(readHeights(), 4.1)).toBe(2);
    expect(countNear(readHeights(), 3.7)).toBe(2);
    expect(countNear(readHeights(), liftedMark)).toBe(2);

    update(createProps({ hoveredId: 'other' }));
    expect(countNear(readHeights(), 4.1)).toBe(2);
    expect(countNear(readHeights(), calmMark)).toBe(2);

    update(createProps({ hoveredId: 'city' }));
    expect(countNear(readHeights(), 4.1)).toBe(0);
    expect(countNear(readHeights(), 3.7)).toBe(4);
  });

  it('draws two layers of sixteen bars for two selected sites and one pair for two hidden sites of one city', async () => {
    const { state, update } = await renderLayers(createProps({ selectedIds: ['own', 'other'] }));

    expect(readMeshes(state()).filter(mesh => mesh.count === 16)).toHaveLength(2);
    expect(readCornerMeshes(state())).toHaveLength(0);

    update(createProps({ selectedIds: ['hidden', 'hidden', 'city'] }));
    expect(readCornerMeshes(state())).toHaveLength(2);

    update(createProps({ selectedIds: ['own', 'hidden', 'ghost'] }));
    expect(readMeshes(state()).filter(mesh => mesh.count === 16)).toHaveLength(2);

    update(createProps({ selectedIds: ['ghost'] }));
    expect(readMeshes(state()).filter(mesh => mesh.count === 8 || mesh.count === 16)).toHaveLength(0);
  });

  it('puts the second frame around the second site and moves both with the same spread', async () => {
    const { state } = await renderLayers(createProps({ selectedIds: ['own', 'other'] }));
    const light = readMeshes(state()).filter(mesh => mesh.count === 16)[1];
    const centerOf = (frameIndex: number): number => {
      let sum = 0;

      for (let index = 0; index < 8; index += 1) {
        sum += light?.array[(frameIndex * 8 + index) * 16 + 12] ?? 0;
      }

      return sum / 8;
    };

    expect(centerOf(0)).toBeCloseTo(-3.2, 3);
    expect(centerOf(1)).toBeCloseTo(3.2, 3);
  });

  it('restarts the appearance of the corners and stops asking for frames when the group changes', async () => {
    const { invalidate, state, update } = await renderLayers(createProps({ selectedIds: ['own'] }));

    for (let frame = 0; frame < 14; frame += 1) {
      drawFrame(state, 1000 + frame * 16);
    }

    const calmCalls = invalidate.mock.calls.length;

    drawFrame(state, 2000);
    expect(invalidate.mock.calls.length).toBe(calmCalls);

    update(createProps({ selectedIds: ['own', 'other'] }));
    expect(invalidate.mock.calls.length).toBeGreaterThan(calmCalls);

    for (let frame = 0; frame < 14; frame += 1) {
      drawFrame(state, 3000 + frame * 16);
    }

    const settledCalls = invalidate.mock.calls.length;

    drawFrame(state, 4000);
    drawFrame(state, 4016);

    expect(invalidate.mock.calls.length).toBe(settledCalls);
  });

  it('grows the chips of all the hovered sites together with the hovered id, and puts them back', async () => {
    const { state, update } = await renderLayers(createProps({}));
    const readHeights = (): number[] => readMeshes(state())
      .filter(mesh => mesh.count === 1)
      .map(mesh => mesh.array[13] ?? 0);
    const countNear = (heights: readonly number[], target: number): number => (
      heights.filter(value => Math.abs(value - target) < 0.01).length
    );

    update(createProps({ hoveredSiteIds: ['own', 'other'] }));
    expect(countNear(readHeights(), 4.1)).toBe(4);
    expect(countNear(readHeights(), 3.7)).toBe(0);

    update(createProps({ hoveredId: 'other', hoveredSiteIds: ['own'] }));
    expect(countNear(readHeights(), 4.1)).toBe(4);

    update(createProps({ hoveredSiteIds: ['own', 'ghost', 'city'] }));
    expect(countNear(readHeights(), 4.1)).toBe(2);
    expect(countNear(readHeights(), 3.7)).toBe(2);

    update(createProps({}));
    expect(countNear(readHeights(), 4.1)).toBe(0);
    expect(countNear(readHeights(), 3.7)).toBe(4);
  });
});
