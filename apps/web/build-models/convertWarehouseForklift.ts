import { writeFile } from 'node:fs/promises';
import { Box3 } from 'three';

import type { TriangleValue } from './warehouseModelGeometry.ts';

import {
  readWarehouseGlb,
  toWarehouseMesh,
} from './warehouseModelGeometry.ts';

const BODY_MATERIALS = new Set(['paint', 'red', 'yellow']);
const CHASSIS_MATERIALS = new Set(['charcoal', 'rubber', 'steel']);
const MAST_NAME = 'parcel-depot-and-sorting-hall-forklift-truck_3';

const [path] = process.argv.slice(2);

if (path === undefined || process.argv.length !== 3) {
  throw new Error('Usage: node apps/web/build-models/convertWarehouseForklift.ts <forklift.glb>');
}

const body: TriangleValue[] = [];
const chassis: TriangleValue[] = [];
const carriage: TriangleValue[] = [];
const mast: TriangleValue[] = [];
const tines: TriangleValue[] = [];
const tineBounds = new Box3();
let tineCount = 0;

for (const { material, name, parentName, triangles } of await readWarehouseGlb(path)) {
  if (parentName === 'forks' && material === 'steel') {
    const bounds = new Box3().setFromPoints(triangles.flat());

    if (bounds.max.z - bounds.min.z > 1) {
      tines.push(...triangles);
      tineBounds.union(bounds);
      tineCount += 1;
    }
    else {
      carriage.push(...triangles);
    }
  }
  else if (name === MAST_NAME && material === 'steel') {
    mast.push(...triangles);
  }
  else if (BODY_MATERIALS.has(material)) {
    body.push(...triangles);
  }
  else if (CHASSIS_MATERIALS.has(material)) {
    chassis.push(...triangles);
  }
  else {
    throw new Error(`Warehouse forklift: unexpected material ${material} in ${parentName}`);
  }
}

if (tineCount !== 2) {
  throw new Error('Warehouse forklift: expected two long tines');
}

const mastBounds = new Box3().setFromPoints(mast.flat());
const model = {
  body: toWarehouseMesh(body, undefined),
  carriage: toWarehouseMesh(carriage, undefined),
  chassis: toWarehouseMesh(chassis, undefined),
  mast: toWarehouseMesh(mast, undefined),
  mastBaseY: Math.round(mastBounds.min.y * 100_000) / 100_000,
  tineBaseZ: Math.round(tineBounds.min.z * 100_000) / 100_000,
  tines: toWarehouseMesh(tines, undefined),
};
const output = new URL('../src/pages/warehouse/scene/warehouseForklift.json', import.meta.url);

await writeFile(output, `{
${Object.entries(model).map(([key, mesh]) => `  "${key}": ${JSON.stringify(mesh)}`).join(',\n')}
}\n`);
