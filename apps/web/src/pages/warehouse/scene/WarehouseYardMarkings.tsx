import type {
  BufferGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Texture,
} from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  ShaderChunk,
  Vector2,
} from 'three';

import { useWorldPalette } from '@/shared/3d';

import type { WarehouseYardVehicleMarkingVisualValue } from '../model/warehouseYardVehicleMarkingVisual';
import type { WarehouseTruckMarkingAtlasValue } from './warehouseTruckMarkingAtlas';
import type { WarehouseTruckModelValue } from './warehouseTruckModel';
import type { WarehouseYardTrafficValue } from './warehouseYardTraffic';

import {
  createWarehouseTruckMarkingAtlas,
  drawWarehouseTruckMarkingAtlas,
  loadWarehouseTruckMarkingLogo,
} from './warehouseTruckMarkingAtlas';
import { paintWarehouseTruckMarkingCell } from './warehouseTruckMarkingCell';
import {
  createWarehouseTruckMarkingGeometry,
  WAREHOUSE_TRUCK_MARKING_UV,
} from './warehouseTruckMarkingGeometry';
import { paintWarehouseTruckColors } from './warehouseTruckModel';

interface WarehouseYardMarkingRigValue {
  model: WarehouseTruckModelValue;
  paint: (traffic: WarehouseYardTrafficValue) => void;
  setAtlas: (atlas: WarehouseTruckMarkingAtlasValue) => void;
}

interface WarehouseYardMarkingsProps {
  geometry: BufferGeometry;
  markings: ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined;
  material: MeshStandardMaterial;
  onModelChange: (model: undefined | WarehouseTruckModelValue) => void;
  traffic: WarehouseYardTrafficValue;
}

const createMarkingRig = (geometry: BufferGeometry, base: MeshStandardMaterial): WarehouseYardMarkingRigValue => {
  const material = base.clone();
  const texture: { value: null | Texture } = { value: null };
  const grid = new Vector2(1, 1);
  const colorsByMesh = new WeakMap<InstancedMesh, InstancedBufferAttribute>();
  const docks: (InstancedMesh | null)[] = [];
  let parking: InstancedMesh | null = null;
  let cells: ReadonlyMap<string, number> | undefined;

  material.customProgramCacheKey = (): string => 'warehouse-marked-truck';
  material.onBeforeCompile = (shader): void => {
    shader.uniforms.yardMarkingAtlas = texture;
    shader.uniforms.yardMarkingGrid = { value: grid };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 ${WAREHOUSE_TRUCK_MARKING_UV};
        varying vec3 vYardMarking;
        uniform vec2 yardMarkingGrid;`)
      .replace('#include <color_vertex>', `${ShaderChunk.color_vertex.replace('vColor.rgb *= instanceColor.rgb;', '')}
        float yardCell = 0.0;
        #ifdef USE_INSTANCING_COLOR
          yardCell = instanceColor.r;
        #endif
        vec2 yardOrigin = vec2(mod(yardCell, yardMarkingGrid.x), yardMarkingGrid.y - 1.0 - floor(yardCell / yardMarkingGrid.x));
        vYardMarking = vec3((yardOrigin + ${WAREHOUSE_TRUCK_MARKING_UV}.xy) / yardMarkingGrid, ${WAREHOUSE_TRUCK_MARKING_UV}.z);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vYardMarking;
        uniform sampler2D yardMarkingAtlas;`)
      .replace('#include <fog_fragment>', `#include <fog_fragment>
        if (vYardMarking.z > 0.5) {
          vec4 marking = texture2D(yardMarkingAtlas, vYardMarking.xy);
          if (marking.a < 0.5) discard;
          gl_FragColor = linearToOutputTexel(marking);
        }`);
  };

  const attachColors = (prev: InstancedMesh | null | undefined, mesh: InstancedMesh | null): void => {
    if (prev != null) {
      prev.instanceColor = null;
    }
    if (mesh !== null) {
      let colors = colorsByMesh.get(mesh);
      if (colors === undefined) {
        colors = new InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3).setUsage(DynamicDrawUsage);
        colorsByMesh.set(mesh, colors);
      }
      mesh.instanceColor = colors;
    }
  };

  return {
    model: {
      geometry,
      material,
      onDockTruck: (lane, mesh): void => {
        attachColors(docks[lane], mesh);
        docks[lane] = mesh;
      },
      onParking: (mesh): void => {
        attachColors(parking, mesh);
        parking = mesh;
      },
    },
    paint: ({ lanes, yard }): void => {
      for (let index = 0; index < docks.length; index += 1) {
        const colors = docks[index]?.instanceColor;
        if (colors != null) {
          paintWarehouseTruckMarkingCell(colors, cells, lanes[index]?.truck.taskId, 0);
        }
      }
      const colors = parking?.instanceColor;
      if (colors != null) {
        const count = Math.min(yard.parked.length, colors.count);
        let written = 0;
        for (let index = 0; index < count; index += 1) {
          const pose = yard.parked[index];
          if (pose !== undefined) {
            paintWarehouseTruckMarkingCell(colors, cells, pose.taskId, written);
            written += 1;
          }
        }
      }
    },
    setAtlas: (atlas): void => {
      texture.value = atlas.texture;
      grid.set(atlas.columns, atlas.rows);
      cells = atlas.cells;
    },
  };
};

const readMarkingPriority = ({ lanes, yard }: WarehouseYardTrafficValue): string[] => {
  const priority: string[] = [];
  for (const lane of lanes) {
    if (lane?.truck.taskId !== undefined && lane.truck.phase !== 'away') {
      priority.push(lane.truck.taskId);
    }
  }
  for (const { taskId } of yard.parked) {
    priority.push(taskId);
  }
  return priority;
};

const WarehouseYardMarkings = ({ geometry, markings, material, onModelChange, traffic }: WarehouseYardMarkingsProps): null => {
  const invalidate = useThree(state => state.invalidate);
  const palette = useWorldPalette();
  const logos = useRef<Map<string, HTMLImageElement> | undefined>(undefined);
  const requests = useRef<Map<string, Promise<HTMLImageElement | undefined>> | undefined>(undefined);
  const markedGeometry = useMemo(() => createWarehouseTruckMarkingGeometry(geometry), [geometry]);
  const rig = useMemo(() => createMarkingRig(markedGeometry, material), [markedGeometry, material]);

  useLayoutEffect(() => {
    return () => {
      onModelChange(undefined);
    };
  }, [onModelChange]);

  useLayoutEffect(() => {
    const atlas = createWarehouseTruckMarkingAtlas(markings, readMarkingPriority(traffic));
    if (atlas === undefined) {
      onModelChange(undefined);
      return undefined;
    }

    let isCurrent = true;
    const available = logos.current ?? new Map<string, HTMLImageElement>();
    const cached = requests.current ?? new Map<string, Promise<HTMLImageElement | undefined>>();
    logos.current = available;
    requests.current = cached;
    paintWarehouseTruckColors(markedGeometry, palette);
    drawWarehouseTruckMarkingAtlas(atlas, markings, palette, available);
    rig.setAtlas(atlas);
    onModelChange(rig.model);
    invalidate();

    const pending = new Set<Promise<HTMLImageElement | undefined>>();
    for (const taskId of atlas.cells.keys()) {
      const path = markings?.get(taskId)?.logoPath;
      if (path !== undefined && !available.has(path)) {
        let request = cached.get(path);
        if (request === undefined) {
          request = loadWarehouseTruckMarkingLogo(path).then((image) => {
            if (image !== undefined) {
              available.set(path, image);
            }
            return image;
          });
          cached.set(path, request);
        }
        pending.add(request);
      }
    }
    if (pending.size > 0) {
      void Promise.all(pending).then((images) => {
        if (isCurrent && images.some(image => image !== undefined)) {
          drawWarehouseTruckMarkingAtlas(atlas, markings, palette, available);
          invalidate();
        }
      });
    }

    return () => {
      isCurrent = false;
      atlas.texture.dispose();
    };
  }, [invalidate, markedGeometry, markings, onModelChange, palette, rig, traffic]);

  useEffect(() => () => {
    markedGeometry.dispose();
    rig.model.material.dispose();
  }, [markedGeometry, rig]);

  useFrame(() => {
    rig.paint(traffic);
  });

  return null;
};

export default WarehouseYardMarkings;
