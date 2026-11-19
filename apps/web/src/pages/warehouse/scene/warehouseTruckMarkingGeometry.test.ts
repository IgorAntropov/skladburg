import {
  Box3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Ray,
  Raycaster,
  Vector3,
} from 'three';
import {
  expect,
  it,
} from 'vitest';

import { createWarehouseTruckMarkingGeometry } from './warehouseTruckMarkingGeometry';
import { createWarehouseTruckGeometry } from './warehouseTruckModel';
import { writeWarehouseHeadlightMatrix } from './warehouseYardLighting';

it('keeps the body and all four outward-facing markings in a single geometry draw', () => {
  const body = createWarehouseTruckGeometry();
  const marked = createWarehouseTruckMarkingGeometry(body);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(marked, material);
  expect(marked.groups).toEqual([]);
  expect(marked.index?.count).toBe(4158);
  expect(marked.index?.array.slice(0, 4134)).toEqual(body.index?.array);

  const surfaces = [
    { direction: [0, 0, 1], distance: 0.94, origin: [0, 0.208, -4] },
    { direction: [0, 0, -1], distance: 1.055, origin: [0, 0.275, 4] },
    { direction: [-1, 0, 0], distance: 1.29, origin: [2, 0.9, -1.94] },
    { direction: [1, 0, 0], distance: 1.29, origin: [-2, 0.9, -1.94] },
  ] as const;
  for (const { direction, distance, origin } of surfaces) {
    const [intersection] = new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(mesh);
    expect(intersection?.distance).toBeCloseTo(distance, 3);
  }

  material.dispose();
  marked.dispose();
  body.dispose();
});

it('gives the full plate an adequate vertical span at the working isometric zoom', () => {
  const geometry = createWarehouseTruckGeometry();
  const marked = createWarehouseTruckMarkingGeometry(geometry);
  const points = marked.getAttribute('position');
  const camera = new OrthographicCamera(-15, 15, 7, -7, 0.1, 100);
  camera.position.set(10, 10, -10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const point = new Vector3();
  for (const offset of [0, 4]) {
    const start = geometry.getAttribute('position').count + offset;
    const top = point.fromBufferAttribute(points, start + 3).project(camera).y;
    const bottom = point.fromBufferAttribute(points, start).project(camera).y;
    const heightCssPx = (top - bottom) * 7 * 64;
    expect(heightCssPx).toBeGreaterThan(15);
  }

  marked.dispose();
  geometry.dispose();
});

it('supports the front plate on the bumper and keeps headlight lenses clear of its isometric silhouette', () => {
  const body = createWarehouseTruckGeometry();
  const marked = createWarehouseTruckMarkingGeometry(body);
  const material = new MeshBasicMaterial();
  const start = body.getAttribute('position').count;
  const position = marked.getAttribute('position');
  const bottomRight = new Vector3().fromBufferAttribute(position, start + 1);
  const topLeft = new Vector3().fromBufferAttribute(position, start + 3);
  const lenses = ([-1, 1] as const).map((side) => {
    const transform = new Matrix4();
    writeWarehouseHeadlightMatrix(transform, 0, 0, 0, side);
    return new Box3(new Vector3(-0.15, -0.0775, -0.0225), new Vector3(0.15, 0.0775, 0.0225)).applyMatrix4(transform);
  });
  const hit = new Vector3();
  for (const azimuth of [-1, 1]) {
    const ray = new Ray(new Vector3(), new Vector3(azimuth, 1, -1).normalize());
    for (let column = 0; column <= 24; column += 1) {
      for (let row = 0; row <= 4; row += 1) {
        ray.origin.set(
          bottomRight.x + (topLeft.x - bottomRight.x) * column / 24,
          bottomRight.y + (topLeft.y - bottomRight.y) * row / 4,
          topLeft.z,
        );
        expect(lenses.some(lens => ray.intersectBox(lens, hit) !== null)).toBe(false);
      }
    }
  }

  const bumperMount = new Vector3(0, topLeft.y - 0.008, topLeft.z);
  const [bumper] = new Raycaster(bumperMount, new Vector3(0, 0, 1)).intersectObject(new Mesh(body, material));
  expect(bumper?.distance).toBeGreaterThan(0);
  expect(bumper?.distance).toBeLessThan(0.035);

  material.dispose();
  marked.dispose();
  body.dispose();
});
