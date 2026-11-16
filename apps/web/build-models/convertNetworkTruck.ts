import type {
  Group,
  Object3D,
} from 'three';

import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Material,
  MathUtils,
  Matrix4,
  Mesh,
  Shape,
  Vector2,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import type { WorldModelRoleValue } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import type { VertexStyleValue } from './createVertexStyleResolver.ts';
import type { TriangleValue } from './warehouseModelGeometry.ts';

import { encodeWorldModelShade } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { prepareModel } from './prepareModel.ts';
import { readTriangles } from './warehouseModelGeometry.ts';
import { writeWorldModel } from './writeWorldModel.ts';

interface PartValue {
  bounds: Box3;
  triangles: TriangleValue[];
}

interface StyledPartValue extends PartValue {
  surface: SurfaceValue;
}

interface SurfaceValue {
  role: WorldModelRoleValue;
  shade: number;
}

const CAB_SURFACES = new Map<string, SurfaceValue>([
  ['accent', { role: 'amber', shade: 1.12 }],
  ['alloy', { role: 'mid', shade: 0.9 }],
  ['glass', { role: 'glass', shade: 0.87 }],
  ['paint', { role: 'mid', shade: 1.08 }],
  ['rubber', { role: 'dark', shade: 0.76 }],
  ['steel', { role: 'dark', shade: 0.98 }],
  ['trim', { role: 'dark', shade: 0.92 }],
  ['white', { role: 'yellow', shade: 1.1 }],
]);

const TRAILER_SURFACES = new Map<string, SurfaceValue>([
  ['accent', { role: 'red', shade: 1.14 }],
  ['alloy', { role: 'mid', shade: 0.9 }],
  ['rubber', { role: 'dark', shade: 0.76 }],
  ['steel', { role: 'dark', shade: 0.96 }],
  ['white', { role: 'light', shade: 1.06 }],
]);

const TRAILER_RIB_SURFACE: SurfaceValue = { role: 'light', shade: 0.86 };
const SUN_DIRECTION = new Vector3(-0.52, 0.81, 0.26).normalize();
const IDENTITY = new Matrix4();
const TARGET_HALF_WIDTH = 0.504;
const TARGET_HEIGHT = 0.978;
const TARGET_REAR_Z = -1.078;
const TARGET_NOSE_Z = 1.038;
const REAR_AXLES_END = -9.75;
const TRACTOR_AXLES_START = -2.28;
const TARGET_REAR_AXLES_END = -0.34;
const TARGET_TRACTOR_AXLES_START = 0.21;
const WHEEL_SEGMENTS = 10;
const LIGHT_WHEEL_SEGMENTS = 6;

const readAsset = async (path: string): Promise<Group> => {
  const bytes = Uint8Array.from(await readFile(path));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, '');

  scene.updateMatrixWorld(true);

  return scene;
};

const couplingPosition = (scene: Group, name: string): Vector3 => {
  const coupling = scene.getObjectByName(name);

  if (coupling === undefined) {
    throw new Error(`Network truck: missing ${name} pivot`);
  }

  return coupling.getWorldPosition(new Vector3());
};

const isBufferGeometry = (geometry: unknown): geometry is BufferGeometry => geometry instanceof BufferGeometry;

const partFromTriangles = (triangles: TriangleValue[]): PartValue => ({
  bounds: new Box3().setFromPoints(triangles.flat()),
  triangles,
});

const splitParts = (triangles: TriangleValue[]): PartValue[] => {
  const adjacent = new Map<Vector3, TriangleValue[]>();

  for (const triangle of triangles) {
    for (const point of triangle) {
      const connected = adjacent.get(point) ?? [];

      connected.push(triangle);
      adjacent.set(point, connected);
    }
  }

  const remaining = new Set(triangles);
  const parts: PartValue[] = [];

  for (const triangle of triangles) {
    if (!remaining.delete(triangle)) {
      continue;
    }

    const connected = [triangle];

    for (const current of connected) {
      for (const point of current) {
        for (const neighbor of adjacent.get(point) ?? []) {
          if (remaining.delete(neighbor)) {
            connected.push(neighbor);
          }
        }
      }
    }

    parts.push(partFromTriangles(connected));
  }

  return parts;
};

const readTransientGeometry = (geometry: BufferGeometry): TriangleValue[] => {
  const triangles = readTriangles(geometry, IDENTITY);

  geometry.dispose();

  return triangles;
};

const createBoxTriangles = (bounds: Box3): TriangleValue[] => {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());

  return readTransientGeometry(new BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z));
};

const createCabTriangles = (bounds: Box3): TriangleValue[] => {
  const { max, min } = bounds;
  const corner = 0.08;
  const profile = new Shape([
    new Vector2(min.x + corner, min.z),
    new Vector2(max.x - corner, min.z),
    new Vector2(max.x, min.z + corner),
    new Vector2(max.x, max.z - corner),
    new Vector2(max.x - corner, max.z),
    new Vector2(min.x + corner, max.z),
    new Vector2(min.x, max.z - corner),
    new Vector2(min.x, min.z + corner),
  ]);
  const geometry = new ExtrudeGeometry(profile, { bevelEnabled: false, depth: max.y - min.y })
    .rotateX(Math.PI / 2)
    .translate(0, max.y, 0);

  return readTransientGeometry(geometry);
};

const createTireTriangles = (bounds: Box3, isLight: boolean): TriangleValue[] => {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const radius = size.y / 2;
  const edge = radius * 0.93;
  const halfWidth = size.x / 2;
  const bevel = Math.min(0.045, halfWidth / 4);
  const profile = center.x < 0
    ? [
        new Vector2(0, -halfWidth),
        new Vector2(edge, -halfWidth),
        new Vector2(radius, -halfWidth + bevel),
        new Vector2(radius, halfWidth),
        new Vector2(0, halfWidth),
      ]
    : [
        new Vector2(0, -halfWidth),
        new Vector2(radius, -halfWidth),
        new Vector2(radius, halfWidth - bevel),
        new Vector2(edge, halfWidth),
        new Vector2(0, halfWidth),
      ];
  const lightProfile = [
    new Vector2(0, -halfWidth),
    new Vector2(radius, -halfWidth),
    new Vector2(radius, halfWidth),
    new Vector2(0, halfWidth),
  ];
  const geometry = new LatheGeometry(
    isLight ? lightProfile : profile,
    isLight ? LIGHT_WHEEL_SEGMENTS : WHEEL_SEGMENTS,
    Math.PI / 2,
  )
    .rotateZ(-Math.PI / 2)
    .translate(center.x, center.y, center.z);

  return readTransientGeometry(geometry);
};

const createHubTriangles = (bounds: Box3, isLight: boolean): TriangleValue[] => {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const side = Math.sign(center.x);
  const x = side > 0 ? bounds.max.x : bounds.min.x;

  const geometry = new CircleGeometry(size.y / 2, isLight ? LIGHT_WHEEL_SEGMENTS : WHEEL_SEGMENTS)
    .rotateY(side * Math.PI / 2)
    .translate(x, center.y, center.z);

  return readTransientGeometry(geometry);
};

const keepLightCabPart = (bounds: Box3, material: string): boolean => {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());

  switch (material) {
    case 'accent':
      return Math.abs(center.x) < 0.1;
    case 'alloy':
      return size.x > 1 && ((center.y > 1.05 && center.y < 1.1) || (center.y > 1.29 && center.y < 1.33));
    case 'steel':
      return size.x > 1.8 || size.z > 4 || (Math.abs(center.x) > 1.2 && bounds.max.y > 2.5);
    case 'trim':
      return bounds.min.z > 1;
    default:
      return true;
  }
};

const getParts = (object: Object3D, isTrailer: boolean, isLight: boolean, surfaces: Map<string, SurfaceValue>): StyledPartValue[] => {
  if (!(object instanceof Mesh) || object.name === 'fifth-wheel' || object.name === 'kingpin') {
    return [];
  }

  const geometry: unknown = object.geometry;
  const material: unknown = object.material;

  if (!isBufferGeometry(geometry) || !geometry.hasAttribute('position') || !(material instanceof Material)) {
    throw new Error('Network truck: expected a positioned mesh with a single material');
  }

  const surface = surfaces.get(material.name);

  if (surface === undefined) {
    throw new Error(`Network truck: unexpected material ${material.name}`);
  }

  if (object.parent?.name.startsWith('wheel-') === true) {
    if (material.name === 'steel') {
      return [];
    }

    const { bounds } = partFromTriangles(readTriangles(geometry, object.matrixWorld));
    const triangles = material.name === 'rubber' ? createTireTriangles(bounds, isLight) : createHubTriangles(bounds, isLight);

    return [{ ...partFromTriangles(triangles), surface }];
  }

  const triangles = readTriangles(geometry, object.matrixWorld);

  if (isTrailer && material.name === 'steel') {
    return splitParts(triangles).flatMap((part) => {
      const { bounds } = part;
      const isRib = Math.abs(bounds.min.x) > 1.24 && bounds.max.x - bounds.min.x < 0.1;
      const isLandingLeg = bounds.min.y < 0.1;
      const isDoorLock = bounds.min.z < -6.8 && bounds.min.y > 1.3;

      if (isLandingLeg || (isRib && Math.abs(bounds.getCenter(new Vector3()).z) < 5.5) || (isLight && (isRib || isDoorLock))) {
        return [];
      }

      return [{ ...part, surface: isRib ? TRAILER_RIB_SURFACE : surface }];
    });
  }

  if (isLight && !isTrailer && material.name === 'paint') {
    if (triangles.length < 100) {
      return [];
    }

    const { bounds } = partFromTriangles(triangles);

    return [{ ...partFromTriangles(createCabTriangles(bounds)), surface }];
  }

  if (isLight && !isTrailer && ['accent', 'alloy', 'steel', 'trim'].includes(material.name)) {
    return splitParts(triangles)
      .filter(part => keepLightCabPart(part.bounds, material.name))
      .map(part => ({ ...partFromTriangles(createBoxTriangles(part.bounds)), surface }));
  }

  if (!isTrailer && material.name === 'alloy') {
    return splitParts(triangles).filter(part => part.bounds.max.y < 3).map(part => ({ ...part, surface }));
  }

  if (!isTrailer && (material.name === 'steel' || material.name === 'glass')) {
    return splitParts(triangles).map(part => (
      part.triangles.length <= 12
        ? { ...part, surface }
        : { ...partFromTriangles(createBoxTriangles(part.bounds)), surface }
    ));
  }

  return [{ ...partFromTriangles(triangles), surface }];
};

const collectParts = (scene: Group, isTrailer: boolean, isLight: boolean): StyledPartValue[] => {
  const parts: StyledPartValue[] = [];
  const surfaces = isTrailer ? TRAILER_SURFACES : CAB_SURFACES;

  scene.traverse((object) => {
    parts.push(...getParts(object, isTrailer, isLight, surfaces));
  });

  return parts;
};

const fitLength = (z: number, bounds: Box3): number => {
  if (z < REAR_AXLES_END) {
    return MathUtils.mapLinear(z, bounds.min.z, REAR_AXLES_END, TARGET_REAR_Z, TARGET_REAR_AXLES_END);
  }

  if (z > TRACTOR_AXLES_START) {
    return MathUtils.mapLinear(z, TRACTOR_AXLES_START, bounds.max.z, TARGET_TRACTOR_AXLES_START, TARGET_NOSE_Z);
  }

  return MathUtils.mapLinear(z, REAR_AXLES_END, TRACTOR_AXLES_START, TARGET_REAR_AXLES_END, TARGET_TRACTOR_AXLES_START);
};

const collectTruckParts = (cab: Group, trailer: Group, isLight: boolean): StyledPartValue[] => {
  const fifthWheel = couplingPosition(cab, 'fifth-wheel');
  const kingpin = couplingPosition(trailer, 'kingpin');
  const trailerTransform = new Matrix4()
    .makeTranslation(fifthWheel.x - kingpin.x, 0, fifthWheel.z - kingpin.z)
    .scale(new Vector3(1, fifthWheel.y / kingpin.y, 1));
  const trailerParts = collectParts(trailer, true, isLight).map(({ surface, triangles }) => {
    const transform = (point: Vector3): Vector3 => point.clone().applyMatrix4(trailerTransform);
    const transformed = triangles.map(([a, b, c]): TriangleValue => [transform(a), transform(b), transform(c)]);

    return { ...partFromTriangles(transformed), surface };
  });
  return [...collectParts(cab, false, isLight), ...trailerParts];
};

const writeTruck = (parts: StyledPartValue[], bounds: Box3, isLight: boolean): Uint8Array => {
  const width = Math.max(-bounds.min.x, bounds.max.x);
  const height = bounds.max.y - bounds.min.y;
  const fitPoint = ({ x, y, z }: Vector3): Vector3 => new Vector3(
    (x / width) * TARGET_HALF_WIDTH,
    ((y - bounds.min.y) / height) * TARGET_HEIGHT,
    fitLength(z, bounds),
  );
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const styles: VertexStyleValue[] = [];
  const edge = new Vector3();
  const normal = new Vector3();

  for (const { surface, triangles } of parts) {
    for (const [first, second, third] of triangles) {
      const a = fitPoint(first);
      const b = fitPoint(second);
      const c = fitPoint(third);

      normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();

      const shade = surface.shade * (0.79 + 0.21 * Math.max(0, normal.dot(SUN_DIRECTION)));
      const style = { role: surface.role, shadeByte: encodeWorldModelShade(shade) };

      for (const point of [a, b, c]) {
        indices.push(styles.length);
        positions.push(point.x, point.y, point.z);
        normals.push(normal.x, normal.y, normal.z);
        styles.push(style);
      }
    }
  }

  const prepared = prepareModel({
    indices: Uint32Array.from(indices),
    normals: Float32Array.from(normals),
    positions: Float32Array.from(positions),
    uvs: new Float32Array(styles.length * 2),
    vertexCount: styles.length,
  }, (_u, _v, vertexId) => {
    const style = styles[vertexId];

    if (style === undefined) {
      throw new Error('Network truck: missing vertex style');
    }

    return style;
  });
  const centerZ = (TARGET_REAR_Z + TARGET_NOSE_Z) / 2;
  const [minX, minY, minZ] = prepared.bounds.min;
  const [maxX, maxY, maxZ] = prepared.bounds.max;
  const bytes = writeWorldModel({
    ...prepared,
    bounds: { max: [maxX, maxY, maxZ + centerZ], min: [minX, minY, minZ + centerZ] },
  });

  const byteLimit = isLight ? 14_000 : 50_000;
  const triangleLimit = isLight ? 624 : 2_200;

  if (bytes.byteLength > byteLimit || prepared.triangleCount > triangleLimit) {
    throw new Error(`Network truck exceeds budget (${String(bytes.byteLength)} bytes, ${String(prepared.triangleCount)} triangles)`);
  }

  return bytes;
};

const [cabPath, trailerPath] = process.argv.slice(2);

if (cabPath === undefined || trailerPath === undefined || process.argv.length !== 4) {
  throw new Error('Usage: node apps/web/build-models/convertNetworkTruck.ts <cab.glb> <trailer.glb>');
}

const [cab, trailer] = await Promise.all([readAsset(cabPath), readAsset(trailerPath)]);
const parts = collectTruckParts(cab, trailer, false);
const bounds = new Box3();

for (const part of parts) {
  bounds.union(part.bounds);
}

const detailed = writeTruck(parts, bounds, false);
const light = writeTruck(collectTruckParts(cab, trailer, true), bounds, true);

await Promise.all([
  writeFile(new URL('../public/models/industrial/route-truck.bin', import.meta.url), detailed),
  writeFile(new URL('../public/models/industrial/route-truck-light.bin', import.meta.url), light),
]);
