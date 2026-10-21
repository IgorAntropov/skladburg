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

import type { NetworkSceneBuildingValue } from '../layout';

import {
  createFakeRenderer,
  ImmediateResizeObserver,
  VIEWPORT_RECT,
} from './canvasTestSupport';
import { NetworkSelectionCorners } from './NetworkSelectionCorners';
import { NetworkSiteChips } from './NetworkSiteChips';

interface LayersPropsValue {
  hoveredId: string | undefined;
  selectedId: string | undefined;
}

const PALETTE = readWorldPalette(() => '#808080');

const CITY = { cityId: 'moscow', hiddenSiteIds: ['hidden'], id: 'city', name: 'Москва', radius: 6.4, x: 0, z: 0 };

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
        <NetworkSiteChips boxGeometry={boxGeometry} buildings={BUILDINGS} hoveredId={props.hoveredId} />
        <NetworkSelectionCorners
          boxGeometry={boxGeometry}
          buildings={BUILDINGS}
          cities={[CITY]}
          selectedId={props.selectedId}
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
    const { state } = await renderLayers({ hoveredId: undefined, selectedId: 'own' });
    const materials = readMaterials(state());

    expect(materials).toHaveLength(readMeshes(state()).length);
    expect(materials.length).toBeGreaterThanOrEqual(9);

    for (const material of materials) {
      expect(material).toBeInstanceOf(MeshBasicMaterial);
      expect(material).toMatchObject({ transparent: false, visible: true });
    }
  });

  it('draws no corners while nothing is selected', async () => {
    const { state } = await renderLayers({ hoveredId: undefined, selectedId: undefined });

    expect(readCornerMeshes(state())).toHaveLength(0);
  });

  it('draws two layers of eight bars for a selected site, a hidden site and a city, and none for an unknown id', async () => {
    const { state, update } = await renderLayers({ hoveredId: undefined, selectedId: 'own' });

    expect(readCornerMeshes(state())).toHaveLength(2);

    update({ hoveredId: undefined, selectedId: 'hidden' });
    expect(readCornerMeshes(state())).toHaveLength(2);

    update({ hoveredId: undefined, selectedId: 'city' });
    expect(readCornerMeshes(state())).toHaveLength(2);

    update({ hoveredId: undefined, selectedId: 'nobody' });
    expect(readCornerMeshes(state())).toHaveLength(0);
  });

  it('brings the corners in over 140 ms and then stops asking for frames', async () => {
    const { invalidate, state } = await renderLayers({ hoveredId: undefined, selectedId: 'own' });
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

    const { invalidate, state } = await renderLayers({ hoveredId: undefined, selectedId: 'own' });
    const light = readCornerMeshes(state())[1];

    invalidate.mockClear();
    drawFrame(state, 1000);
    drawFrame(state, 1016);

    expect(readCornerReach(light)).toBeCloseTo(4.85, 3);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('gives a house mark only to the chip of an own site', async () => {
    const { state } = await renderLayers({ hoveredId: undefined, selectedId: undefined });
    const meshes = readMeshes(state());

    expect(meshes.filter(mesh => mesh.count === 1)).toHaveLength(6);
    expect(meshes.filter(mesh => mesh.count === 2)).toHaveLength(1);
  });

  it('grows the hovered chip with its mark, lifts it and puts it back', async () => {
    const { state, update } = await renderLayers({ hoveredId: undefined, selectedId: undefined });
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

    update({ hoveredId: 'own', selectedId: undefined });
    expect(countNear(readHeights(), 4.1)).toBe(2);
    expect(countNear(readHeights(), 3.7)).toBe(2);
    expect(countNear(readHeights(), liftedMark)).toBe(2);

    update({ hoveredId: 'other', selectedId: undefined });
    expect(countNear(readHeights(), 4.1)).toBe(2);
    expect(countNear(readHeights(), calmMark)).toBe(2);

    update({ hoveredId: 'city', selectedId: undefined });
    expect(countNear(readHeights(), 4.1)).toBe(0);
    expect(countNear(readHeights(), 3.7)).toBe(4);
  });
});
