import type { RootState } from '@react-three/fiber';
import type { ReactElement } from 'react';
import type { OrthographicCamera } from 'three';
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
  BufferGeometry,
  CanvasTexture,
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

import type { NetworkMapSiteValue } from '@/entities/network';

import {
  readWorldPalette,
  WorldMaterialsProvider,
} from '@/shared/3d';

import type { ISiteBannerAtlas } from '../banner/createSiteBannerAtlas';
import type { SiteBannerCellUvValue } from '../banner/siteBannerAtlasLayout';
import type { SiteMarkModeValue } from '../banner/siteMarkMetrics';
import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import { SITE_BANNER_CELL_NEAR_ATTRIBUTE } from '../banner/createSiteBannerMaterial';
import { createTestMapSite } from '../banner/siteBannerTestSupport';
import {
  createSiteMarkMode,
  SITE_MARK_NEAR_ENTER_ZOOM,
  SITE_MARK_NEAR_EXIT_ZOOM,
  SITE_MARK_OWN_FAR_UP_METERS,
  SITE_MARK_OWN_NEAR_UP_METERS,
} from '../banner/siteMarkMetrics';
import {
  createFakeRenderer,
  ImmediateResizeObserver,
  VIEWPORT_RECT,
} from './canvasTestSupport';
import { NetworkSelectionCorners } from './NetworkSelectionCorners';
import { NetworkSiteMarks } from './NetworkSiteMarks';

interface LayersPropsValue {
  hoveredId: string | undefined;
  hoveredSiteIds: readonly string[];
  selectedIds: readonly string[];
}

interface MarkDataValue {
  buildings: readonly NetworkSceneBuildingValue[];
  sites: readonly NetworkMapSiteValue[];
}

interface MeshReadingValue {
  array: ArrayLike<number>;
  count: number;
  hasCells: boolean;
  material: unknown;
}

const createProps = (overrides: Partial<LayersPropsValue>): LayersPropsValue => ({
  hoveredId: undefined,
  hoveredSiteIds: [],
  selectedIds: [],
  ...overrides,
});

const PALETTE = readWorldPalette(() => '#808080');

const FAKE_CELL: SiteBannerCellUvValue = { u0: 0, u1: 0.5, v0: 0, v1: 0.5 };

const FAKE_ATLAS: ISiteBannerAtlas = {
  dispose: (): void => undefined,
  getFarCell: (): SiteBannerCellUvValue => FAKE_CELL,
  getNearCell: (): SiteBannerCellUvValue => FAKE_CELL,
  redraw: (): boolean => false,
  texture: new CanvasTexture(document.createElement('canvas')),
};

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

const CALM_HEIGHT = 3.7;
const LIFTED_HEIGHT = 4.1;
const STRETCH = Math.sqrt(1.5);
const HOVER_SCALE = 1.25;
const HEIGHT_TOLERANCE = 0.01;
const FAR_MARKER_HEIGHT = CALM_HEIGHT + SITE_MARK_OWN_FAR_UP_METERS * STRETCH;
const NEAR_MARKER_HEIGHT = CALM_HEIGHT + SITE_MARK_OWN_NEAR_UP_METERS * STRETCH;
const MATRIX_HEIGHT_OFFSET = 13;
const MATRIX_ITEM_SIZE = 16;

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

const createMarkData = (count: number, ownCount: number): MarkDataValue => {
  const sides = ['customer', 'supplier'] as const;
  const buildings: NetworkSceneBuildingValue[] = [];
  const sites: NetworkMapSiteValue[] = [];

  for (let index = 0; index < count; index += 1) {
    const side = sides[index % sides.length] ?? 'customer';
    const id = `site-${String(index)}`;

    buildings.push(createWarehouse(id, index < ownCount, index * 4 - 40, side));
    sites.push(createTestMapSite(id, `org-${String(index)}`, {
      isOwn: index < ownCount,
      organizationName: `Компания ${String(index)}`,
      side,
    }));
  }

  return { buildings, sites };
};

const PAIR_DATA: MarkDataValue = {
  buildings: [createWarehouse('own', true, -3.2, 'customer'), createWarehouse('other', false, 3.2, 'supplier')],
  sites: [
    createTestMapSite('own', 'org-own', { isOwn: true, organizationName: 'Заказчик 1', side: 'customer' }),
    createTestMapSite('other', 'org-other', { organizationName: 'Поставщик 1', side: 'supplier' }),
  ],
};

const readMeshes = (state: RootState): MeshReadingValue[] => {
  const meshes: MeshReadingValue[] = [];

  state.scene.traverse((object) => {
    if (object instanceof InstancedMesh) {
      const geometry: unknown = object.geometry;
      const material: unknown = object.material;

      meshes.push({
        array: object.instanceMatrix.array,
        count: object.count,
        hasCells: geometry instanceof BufferGeometry && SITE_BANNER_CELL_NEAR_ATTRIBUTE in geometry.attributes,
        material,
      });
    }
  });

  return meshes;
};

const readBannerMesh = (state: RootState): MeshReadingValue | undefined => readMeshes(state).find(
  reading => reading.hasCells,
);

const readMarkerMeshes = (state: RootState, ownCount: number): MeshReadingValue[] => readMeshes(state).filter(
  reading => reading.count === ownCount && !reading.hasCells,
);

const readBannerHeights = (state: RootState): number[] => {
  const banner = readBannerMesh(state);

  return Array.from({ length: banner?.count ?? 0 }, (_, index) => (
    banner?.array[index * MATRIX_ITEM_SIZE + MATRIX_HEIGHT_OFFSET] ?? 0
  ));
};

const countNear = (heights: readonly number[], target: number): number => (
  heights.filter(value => Math.abs(value - target) < HEIGHT_TOLERANCE).length
);

const readBannerFar = (state: RootState): number | undefined => {
  const material = readBannerMesh(state)?.material;
  const shader = {
    fragmentShader: '#include <common>\n#include <map_fragment>',
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <common>\n#include <begin_vertex>',
  };

  if (!(material instanceof MeshBasicMaterial)) {
    return undefined;
  }

  material.onBeforeCompile(shader as never, undefined as never);

  return Number(shader.uniforms.uSiteBannerFar?.value);
};

const renderLayers = async (
  initial: LayersPropsValue,
  data: MarkDataValue = PAIR_DATA,
  atlas: ISiteBannerAtlas | null = FAKE_ATLAS,
): Promise<{
  invalidate: Mock;
  markMode: SiteMarkModeValue;
  state: () => RootState;
  update: (props: LayersPropsValue) => void;
}> => {
  let latest: RootState | undefined;
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const invalidate = vi.fn();
  const markMode = createSiteMarkMode();

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
        <NetworkSiteMarks
          atlas={atlas ?? undefined}
          boxGeometry={boxGeometry}
          buildings={data.buildings}
          hoveredId={props.hoveredId}
          hoveredSiteIds={props.hoveredSiteIds}
          markMode={markMode}
          sites={data.sites}
        />
        <NetworkSelectionCorners
          boxGeometry={boxGeometry}
          buildings={data.buildings}
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
    markMode,
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

const setZoom = (state: () => RootState, zoom: number): void => {
  const camera = state().camera as OrthographicCamera;

  camera.zoom = zoom;
  camera.updateProjectionMatrix();
};

const readMaterials = (state: RootState): unknown[] => readMeshes(state).map(reading => reading.material);

const readCornerMeshes = (state: RootState): MeshReadingValue[] => readMeshes(state).filter(mesh => mesh.count === 8);

const readCornerReach = (mesh: MeshReadingValue | undefined): number => {
  const array = mesh?.array ?? [];
  let reach = 0;

  for (let index = 0; index < 8; index += 1) {
    reach = Math.max(reach, Math.abs(array[index * 16 + 12] ?? 0));
  }

  return reach;
};

describe('selection and site mark layers', () => {
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

  it('draws the banners, the house marks, the posts and the corners with materials that no light touches', async () => {
    const { state } = await renderLayers(createProps({ selectedIds: ['own'] }));
    const materials = readMaterials(state());

    expect(materials).toHaveLength(readMeshes(state()).length);
    expect(materials).toHaveLength(6);

    for (const material of materials) {
      expect(material).toBeInstanceOf(MeshBasicMaterial);
      expect(material).toMatchObject({ toneMapped: false, transparent: false, visible: true });
    }
  });

  it('draws four layers for three sites and four for thirty', async () => {
    const three = await renderLayers(createProps({}), createMarkData(3, 1));

    expect(readMeshes(three.state())).toHaveLength(4);

    cleanup();

    const thirty = await renderLayers(createProps({}), createMarkData(30, 1));

    expect(readMeshes(thirty.state())).toHaveLength(4);
    expect(readBannerMesh(thirty.state())?.count).toBe(30);
  });

  it('draws only the posts and the marks of own sites while the atlas is not ready', async () => {
    const { state } = await renderLayers(createProps({}), PAIR_DATA, null);

    expect(readBannerMesh(state())).toBeUndefined();
    expect(readMeshes(state())).toHaveLength(3);
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

  it('gives a house mark only to the site of an own organization', async () => {
    const own = await renderLayers(createProps({}), createMarkData(5, 1));

    expect(readMarkerMeshes(own.state(), 1)).toHaveLength(2);

    cleanup();

    const twoOwn = await renderLayers(createProps({}), createMarkData(5, 2));

    expect(readMarkerMeshes(twoOwn.state(), 2)).toHaveLength(2);

    cleanup();

    const none = await renderLayers(createProps({}), createMarkData(5, 0));

    expect(readMeshes(none.state())).toHaveLength(2);
  });

  it('grows the hovered banner with its mark, lifts it and puts it back', async () => {
    const { state, update } = await renderLayers(createProps({}));
    const readMarkerHeight = (): number => readMarkerMeshes(state(), 1)[0]?.array[MATRIX_HEIGHT_OFFSET] ?? 0;
    const liftedMark = LIFTED_HEIGHT + SITE_MARK_OWN_FAR_UP_METERS * HOVER_SCALE * STRETCH;

    expect(countNear(readBannerHeights(state()), CALM_HEIGHT)).toBe(2);
    expect(readMarkerHeight()).toBeCloseTo(FAR_MARKER_HEIGHT, 2);

    update(createProps({ hoveredId: 'own' }));
    expect(countNear(readBannerHeights(state()), LIFTED_HEIGHT)).toBe(1);
    expect(countNear(readBannerHeights(state()), CALM_HEIGHT)).toBe(1);
    expect(readMarkerHeight()).toBeCloseTo(liftedMark, 2);

    update(createProps({ hoveredId: 'other' }));
    expect(countNear(readBannerHeights(state()), LIFTED_HEIGHT)).toBe(1);
    expect(readMarkerHeight()).toBeCloseTo(FAR_MARKER_HEIGHT, 2);

    update(createProps({ hoveredId: 'city' }));
    expect(countNear(readBannerHeights(state()), LIFTED_HEIGHT)).toBe(0);
    expect(countNear(readBannerHeights(state()), CALM_HEIGHT)).toBe(2);
  });

  it('asks for one frame when the hovered site changes', async () => {
    const { invalidate, update } = await renderLayers(createProps({}));

    invalidate.mockClear();
    update(createProps({ hoveredId: 'own' }));

    expect(invalidate).toHaveBeenCalledTimes(1);

    invalidate.mockClear();
    update(createProps({ hoveredId: 'other' }));

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('asks for no frames while the camera stands still', async () => {
    const { invalidate, state } = await renderLayers(createProps({}));

    drawFrame(state, 1000);
    invalidate.mockClear();

    drawFrame(state, 1016);
    drawFrame(state, 1032);
    drawFrame(state, 1048);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('starts in the far view and switches the uniform and the own marks with the zoom, keeping the view inside the band', async () => {
    const { invalidate, markMode, state } = await renderLayers(createProps({}));
    const readMarkerHeight = (): number => readMarkerMeshes(state(), 1)[0]?.array[MATRIX_HEIGHT_OFFSET] ?? 0;

    expect(markMode.isFar).toBe(true);
    expect(readBannerFar(state())).toBe(1);

    setZoom(state, SITE_MARK_NEAR_ENTER_ZOOM + 1);
    drawFrame(state, 1000);

    expect(markMode.isFar).toBe(false);
    expect(readBannerFar(state())).toBe(0);
    expect(readMarkerHeight()).toBeCloseTo(NEAR_MARKER_HEIGHT, 2);

    setZoom(state, SITE_MARK_NEAR_EXIT_ZOOM + 1);
    drawFrame(state, 1016);

    expect(markMode.isFar).toBe(false);
    expect(readBannerFar(state())).toBe(0);

    invalidate.mockClear();
    setZoom(state, SITE_MARK_NEAR_EXIT_ZOOM - 1);
    drawFrame(state, 1032);

    expect(markMode.isFar).toBe(true);
    expect(readBannerFar(state())).toBe(1);
    expect(readMarkerHeight()).toBeCloseTo(FAR_MARKER_HEIGHT, 2);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('takes the view of the camera at once when the layer is set up again', async () => {
    const { markMode, state, update } = await renderLayers(createProps({}));

    setZoom(state, SITE_MARK_NEAR_ENTER_ZOOM + 10);
    update(createProps({ hoveredId: 'own' }));

    expect(markMode.isFar).toBe(false);
    expect(readBannerFar(state())).toBe(0);
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

  it('grows the banners of all the hovered sites together with the hovered id, and puts them back', async () => {
    const { state, update } = await renderLayers(createProps({}));

    update(createProps({ hoveredSiteIds: ['own', 'other'] }));
    expect(countNear(readBannerHeights(state()), LIFTED_HEIGHT)).toBe(2);
    expect(countNear(readBannerHeights(state()), CALM_HEIGHT)).toBe(0);

    update(createProps({ hoveredId: 'other', hoveredSiteIds: ['own'] }));
    expect(countNear(readBannerHeights(state()), LIFTED_HEIGHT)).toBe(2);

    update(createProps({ hoveredSiteIds: ['own', 'ghost', 'city'] }));
    expect(countNear(readBannerHeights(state()), LIFTED_HEIGHT)).toBe(1);
    expect(countNear(readBannerHeights(state()), CALM_HEIGHT)).toBe(1);

    update(createProps({}));
    expect(countNear(readBannerHeights(state()), LIFTED_HEIGHT)).toBe(0);
    expect(countNear(readBannerHeights(state()), CALM_HEIGHT)).toBe(2);
  });
});
