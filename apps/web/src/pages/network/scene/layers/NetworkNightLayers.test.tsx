import type { RootState } from '@react-three/fiber';
import type { Object3D } from 'three';

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
  MeshStandardMaterial,
} from 'three';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  readWorldPalette,
  WORLD_GLOW_DELAY_ATTRIBUTE,
  WorldMaterialsProvider,
} from '@/shared/3d';

import {
  buildStreetLamps,
  buildWindowInstances,
} from '../night';
import { buildSampleLayout } from '../night/nightTestSupport';
import {
  createFakeRenderer,
  ImmediateResizeObserver,
  VIEWPORT_RECT,
} from './canvasTestSupport';
import { NetworkLampLight } from './NetworkLampLight';
import { NetworkStreetLamps } from './NetworkStreetLamps';
import { NetworkWindows } from './NetworkWindows';

const PALETTE = readWorldPalette(() => '#808080');

const LAYOUT = buildSampleLayout();
const WINDOWS = buildWindowInstances(LAYOUT.buildings, LAYOUT.cities);
const LAMPS = buildStreetLamps(LAYOUT.roads, LAYOUT.cities);

interface CanvasHandleValue {
  state: () => RootState;
  unmount: () => void;
}

const renderNight = async (level: QualityLevelValue): Promise<CanvasHandleValue> => {
  let latest: RootState | undefined;
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const Probe = (): null => {
    const get = useThree(current => current.get);

    useEffect(() => {
      latest = get();
    }, [get]);

    return null;
  };

  const result = render(
    <Canvas
      frameloop="never"
      gl={(defaultProps): never => createFakeRenderer(defaultProps.canvas) as never}
      orthographic
    >
      <Probe />
      <WorldMaterialsProvider palette={PALETTE}>
        <NetworkWindows level={level} windows={WINDOWS} />
        <NetworkStreetLamps boxGeometry={boxGeometry} lamps={LAMPS} level={level} />
        <NetworkLampLight lamps={LAMPS} level={level} />
      </WorldMaterialsProvider>
    </Canvas>,
  );

  await waitFor(() => {
    expect(latest).toBeDefined();
  });

  return {
    state: (): RootState => {
      if (latest === undefined) {
        throw new Error('The canvas is not created');
      }

      return latest;
    },
    unmount: (): void => {
      act(() => {
        result.unmount();
      });
    },
  };
};

const isInstancedMesh = (object: Object3D): object is InstancedMesh => object instanceof InstancedMesh;

const readMeshes = (state: RootState): InstancedMesh[] => {
  const meshes: InstancedMesh[] = [];

  state.scene.traverse((object) => {
    if (isInstancedMesh(object)) {
      meshes.push(object);
    }
  });

  return meshes;
};

const readDelays = (mesh: InstancedMesh): ArrayLike<number> | undefined =>
  mesh.geometry.hasAttribute(WORLD_GLOW_DELAY_ATTRIBUTE)
    ? mesh.geometry.getAttribute(WORLD_GLOW_DELAY_ATTRIBUTE).array
    : undefined;

const isAdditive = (mesh: InstancedMesh): boolean =>
  mesh.material instanceof MeshBasicMaterial && mesh.material.transparent;

const isGlowOpaque = (mesh: InstancedMesh): boolean =>
  mesh.material instanceof MeshBasicMaterial && !mesh.material.transparent;

const isPlane = (mesh: InstancedMesh): boolean => mesh.geometry.getAttribute('position').count === 4;

const isPool = (mesh: InstancedMesh): boolean => isAdditive(mesh) && mesh.geometry.index !== null;

const isHalo = (mesh: InstancedMesh): boolean => isAdditive(mesh) && mesh.geometry.index === null;

const isPole = (mesh: InstancedMesh): boolean => mesh.material instanceof MeshStandardMaterial;

const isHead = (mesh: InstancedMesh): boolean => isGlowOpaque(mesh) && !isPlane(mesh);

const findOne = (state: RootState, predicate: (mesh: InstancedMesh) => boolean): InstancedMesh => {
  const found = readMeshes(state).filter(predicate);
  const [mesh] = found;

  if (found.length !== 1 || mesh === undefined) {
    throw new Error(`Expected one mesh, found ${String(found.length)}`);
  }

  return mesh;
};

describe('night layers of the network map', () => {
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

  it('draws the windows in one glowing mesh with a delay for every window and no shadows', async () => {
    const { state } = await renderNight('high');
    const windowMesh = findOne(state(), mesh => isGlowOpaque(mesh) && isPlane(mesh));

    expect(windowMesh.count).toBe(WINDOWS.count);
    expect(readDelays(windowMesh)).toBe(WINDOWS.delays);
    expect(readDelays(windowMesh)?.length).toBe(WINDOWS.count);
    expect(windowMesh.castShadow).toBe(false);
    expect(windowMesh.receiveShadow).toBe(false);
  });

  it('draws the poles lit and without delays and the heads glowing with a delay for every lamp', async () => {
    const { state } = await renderNight('high');
    const pole = findOne(state(), isPole);
    const head = findOne(state(), isHead);

    expect(pole.count).toBe(LAMPS.count);
    expect(readDelays(pole)).toBeUndefined();
    expect(head.count).toBe(LAMPS.count);
    expect(readDelays(head)).toBe(LAMPS.delays);
    expect(readDelays(head)?.length).toBe(LAMPS.count);

    for (const mesh of [pole, head]) {
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
    }
  });

  it('draws the light pool of every lamp and the halo only on the level that has one', async () => {
    const high = await renderNight('high');
    const pool = findOne(high.state(), isPool);
    const halo = findOne(high.state(), isHalo);

    expect(QUALITY_LEVEL_SETTINGS.high.hasGlowHalo).toBe(true);
    expect(pool.count).toBe(LAMPS.count);
    expect(readDelays(pool)).toBe(LAMPS.delays);
    expect(halo.count).toBe(LAMPS.count);
    expect(readDelays(halo)).toBe(LAMPS.delays);
    expect(pool.castShadow || halo.castShadow || pool.receiveShadow || halo.receiveShadow).toBe(false);

    cleanup();

    for (const level of ['medium', 'low'] as const) {
      const { state } = await renderNight(level);

      expect(QUALITY_LEVEL_SETTINGS[level].hasGlowHalo).toBe(false);
      expect(readMeshes(state()).filter(isHalo)).toHaveLength(0);
      expect(readMeshes(state()).filter(isPool)).toHaveLength(1);
      cleanup();
    }
  });

  it('shows the share of lamps and windows that the level asks for', async () => {
    const levels = ['low', 'medium', 'high'] as const;
    const lampCounts: number[] = [];
    const windowCounts: number[] = [];

    for (const level of levels) {
      const { state } = await renderNight(level);

      lampCounts.push(findOne(state(), isHead).count);
      windowCounts.push(findOne(state(), mesh => isGlowOpaque(mesh) && isPlane(mesh)).count);
      cleanup();
    }

    expect(lampCounts).toEqual(levels.map(level => LAMPS.getVisibleCount(QUALITY_LEVEL_SETTINGS[level].decorDensity)));
    expect(windowCounts).toEqual(levels.map(level => WINDOWS.getVisibleCount(QUALITY_LEVEL_SETTINGS[level].decorDensity)));
    expect(lampCounts[0]).toBeLessThan(lampCounts[1] ?? 0);
    expect(lampCounts[1]).toBeLessThan(lampCounts[2] ?? 0);
    expect(windowCounts[0]).toBeLessThan(windowCounts[2] ?? 0);
  });

  it('releases the geometries it made for the layers on unmount and leaves the shared box alone', async () => {
    const { state, unmount } = await renderNight('high');
    const meshes = readMeshes(state());
    const spies = meshes.map(mesh => ({ isOwn: readDelays(mesh) !== undefined, spy: vi.spyOn(mesh.geometry, 'dispose') }));

    unmount();

    expect(spies).toHaveLength(5);
    expect(spies.filter(entry => entry.isOwn)).toHaveLength(4);

    for (const { isOwn, spy } of spies) {
      expect(spy.mock.calls.length > 0).toBe(isOwn);
    }
  });
});
