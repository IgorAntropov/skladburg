import { writeFile } from 'node:fs/promises';
import {
  Box3,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  MathUtils,
  Matrix4,
  Vector3,
} from 'three';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

import type { TriangleValue } from './warehouseModelGeometry.ts';

import {
  WAREHOUSE_TRUCK_COLORS,
  WAREHOUSE_TRUCK_DECK_FRONT_Z,
  WAREHOUSE_TRUCK_DECK_REAR_Z,
  WAREHOUSE_TRUCK_DECK_Y,
  WAREHOUSE_TRUCK_FRONT_Z,
  WAREHOUSE_TRUCK_HALF_WIDTH,
  WAREHOUSE_TRUCK_HEIGHT,
  WAREHOUSE_TRUCK_POSITION_SCALE,
} from '../src/pages/warehouse/scene/warehouseTruckDimensions.ts';
import {
  readTriangles,
  readWarehouseGlb,
} from './warehouseModelGeometry.ts';

type ColorValue = (typeof WAREHOUSE_TRUCK_COLORS)[number];
type MeshValue = Awaited<ReturnType<typeof readWarehouseGlb>>[number];

const CAB_COLORS = new Map<string, ColorValue>([
  ['accent', 'windowGlow'],
  ['alloy', 'sideRim'],
  ['glass', 'windowGlass'],
  ['paint', 'sideCarrier'],
  ['steel', 'warehouseRoof'],
  ['trim', 'road'],
  ['white', 'windowGlow'],
]);
const IDENTITY = new Matrix4();
const WHEEL_SEGMENTS = 10;
const MIN_SIMPLIFIED_TRIANGLES = 120;
const MAX_BODY_TRIANGLE_SHARE = 0.43;

const boundsOf = (triangles: readonly TriangleValue[]): Box3 => new Box3().setFromPoints(triangles.flat());

const centerOfPart = (parts: readonly MeshValue[], name: string): Vector3 => {
  const part = parts.find(current => current.name === name);

  if (part === undefined) {
    throw new Error(`Warehouse truck: missing ${name}`);
  }

  return boundsOf(part.triangles).getCenter(new Vector3());
};

const reduceMesh = async (triangles: TriangleValue[]): Promise<TriangleValue[]> => {
  if (triangles.length <= MIN_SIMPLIFIED_TRIANGLES) {
    return triangles;
  }

  const positions = triangles.flatMap(triangle => triangle.flatMap(point => point.toArray()));
  const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3));
  const welded = mergeVertices(source);
  const count = welded.getAttribute('position').count;
  const simplified = await new SimplifyModifier().modify(welded, Math.round(count * (1 - MAX_BODY_TRIANGLE_SHARE)));
  const result = readTriangles(simplified, IDENTITY);

  source.dispose();
  welded.dispose();
  simplified.dispose();

  return result;
};

const [, , tractorPath, trailerPath, outputPath] = process.argv;

if (tractorPath === undefined || trailerPath === undefined || outputPath === undefined) {
  throw new Error('Usage: node convertWarehouseTruck.ts <tractor.glb> <flatbed.glb> <model.json>');
}

const [tractor, flatbed] = await Promise.all([readWarehouseGlb(tractorPath), readWarehouseGlb(trailerPath)]);
const fifthWheel = centerOfPart(tractor, 'fifth-wheel');
const kingpin = centerOfPart(flatbed, 'kingpin');
const trailerFit = (point: Vector3): Vector3 => new Vector3(
  point.x + fifthWheel.x - kingpin.x,
  point.y * (fifthWheel.y / kingpin.y),
  point.z + fifthWheel.z - kingpin.z,
);
const body = flatbed.find(part => part.material === 'steel' && !part.parentName.startsWith('wheel-') && part.name !== 'kingpin');
if (body === undefined) {
  throw new Error('Warehouse truck: missing flatbed');
}
const deck = boundsOf(body.triangles.filter(triangle => triangle.every(point => point.y >= 1.19)));
if (deck.isEmpty()) {
  throw new Error('Warehouse truck: missing deck surface');
}
const deckRearZ = trailerFit(deck.min).z;
const deckFrontZ = trailerFit(deck.max).z;
const deckY = trailerFit(deck.max).y;
const cabBounds = boundsOf(tractor.flatMap(part => part.name === 'fifth-wheel' ? [] : part.triangles));
const rearAxleZ = trailerFit(new Vector3(0, 0, -5.65)).z;
const frontAxleZ = trailerFit(new Vector3(0, 0, -3.45)).z;
const rearAxleAt = 2.27;
const frontAxleAt = 1.09;

const fitLength = (z: number): number => {
  if (z <= rearAxleZ) {
    return MathUtils.mapLinear(z, deckRearZ, rearAxleZ, WAREHOUSE_TRUCK_DECK_REAR_Z, rearAxleAt);
  }
  if (z <= frontAxleZ) {
    return MathUtils.mapLinear(z, rearAxleZ, frontAxleZ, rearAxleAt, frontAxleAt);
  }
  if (z <= deckFrontZ) {
    return MathUtils.mapLinear(z, frontAxleZ, deckFrontZ, frontAxleAt, WAREHOUSE_TRUCK_DECK_FRONT_Z);
  }

  return MathUtils.mapLinear(z, deckFrontZ, cabBounds.max.z, WAREHOUSE_TRUCK_DECK_FRONT_Z, WAREHOUSE_TRUCK_FRONT_Z);
};

const fit = ({ x, y, z }: Vector3): Vector3 => new Vector3(
  -x * WAREHOUSE_TRUCK_HALF_WIDTH / Math.max(-cabBounds.min.x, cabBounds.max.x),
  y <= deckY
    ? MathUtils.mapLinear(y, 0, deckY, 0, WAREHOUSE_TRUCK_DECK_Y)
    : MathUtils.mapLinear(y, deckY, cabBounds.max.y, WAREHOUSE_TRUCK_DECK_Y, WAREHOUSE_TRUCK_HEIGHT),
  fitLength(z),
);

const positions: number[] = [];
const indexDeltas: number[] = [];
const colors: number[] = [];
const indexByPosition = new Map<string, number>();
let previousIndex = 0;

const addTriangles = (triangles: readonly TriangleValue[], material: ColorValue): void => {
  const color = WAREHOUSE_TRUCK_COLORS.indexOf(material);
  const quantize = (point: Vector3): Vector3 => point.clone().multiplyScalar(WAREHOUSE_TRUCK_POSITION_SCALE).round();
  const edge = new Vector3();
  const normal = new Vector3();

  for (const [first, second, third] of triangles) {
    const a = quantize(first);
    const b = quantize(second);
    const c = quantize(third);
    normal.subVectors(b, a).cross(edge.subVectors(c, a));

    if (normal.lengthSq() === 0) {
      continue;
    }

    for (const point of [a, b, c]) {
      const position = point.toArray();
      const key = `${position.join(',')}|${String(color)}`;
      let index = indexByPosition.get(key);

      if (index === undefined) {
        index = colors.length;
        indexByPosition.set(key, index);
        positions.push(...position);
        colors.push(color);
      }
      indexDeltas.push(index - previousIndex);
      previousIndex = index;
    }
  }
};

const addGeometry = (geometry: BufferGeometry, color: ColorValue): void => {
  addTriangles(readTriangles(geometry, IDENTITY), color);
  geometry.dispose();
};

const addWheel = (part: MeshValue, transform: (point: Vector3) => Vector3): void => {
  const bounds = boundsOf(part.triangles);
  const size = bounds.getSize(new Vector3());
  const center = transform(bounds.getCenter(new Vector3()));
  const corners = [transform(bounds.min), transform(bounds.max)] as const;
  const width = Math.abs(corners[0].x - corners[1].x);
  const radius = Math.abs(corners[0].y - corners[1].y) / 2;

  if (part.material === 'rubber') {
    const tire = new CylinderGeometry(radius, radius, width, WHEEL_SEGMENTS)
      .rotateY(Math.PI / 2)
      .rotateZ(Math.PI / 2)
      .translate(center.x, center.y, center.z);

    addGeometry(tire, 'road');
  }
  else if (part.material === 'alloy') {
    const side = Math.sign(center.x);
    const outer = center.x + side * width / 2;
    const isHub = size.y > 0.1;

    if (isHub) {
      addGeometry(new CircleGeometry(radius, WHEEL_SEGMENTS).rotateY(side * Math.PI / 2).translate(outer, center.y, center.z), 'sideRim');
    }
  }
};

for (const part of tractor) {
  if (part.name === 'fifth-wheel') {
    continue;
  }
  if (part.parentName.startsWith('wheel-')) {
    addWheel(part, fit);
    continue;
  }

  const color = CAB_COLORS.get(part.material);

  if (color !== undefined) {
    const triangles = await reduceMesh(part.triangles.map(([a, b, c]): TriangleValue => [fit(a), fit(b), fit(c)]));

    addTriangles(triangles, color);
  }
}

const fitTrailer = (point: Vector3): Vector3 => fit(trailerFit(point));
for (const part of flatbed) {
  if (part.name === 'kingpin') {
    continue;
  }
  if (part.parentName.startsWith('wheel-')) {
    addWheel(part, fitTrailer);
    continue;
  }

  for (const triangle of part.triangles) {
    const isLandingLeg = triangle.every(point => point.z > 4.6 && point.z < 5) && triangle.some(point => point.y < 1.19);

    if (isLandingLeg) {
      continue;
    }

    const hasDeckMaterial = triangle.every(point => point.y >= 1.19);
    const color = part.material === 'accent' ? 'buildingBrick' : hasDeckMaterial ? 'warehouseWall' : 'warehouseRoof';
    const [a, b, c] = triangle;

    addTriangles([[fitTrailer(a), fitTrailer(b), fitTrailer(c)]], color);
  }
}

await writeFile(outputPath, `${JSON.stringify({ colors, indexDeltas, positions })}\n`);
