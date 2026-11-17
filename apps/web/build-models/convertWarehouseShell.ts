import { writeFile } from 'node:fs/promises';
import {
  Box3,
  Texture,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import type { TriangleValue } from './warehouseModelGeometry.ts';

import { readWarehouseGlb } from './warehouseModelGeometry.ts';

type PointValue = (point: Vector3) => Vector3;
type ShellBatchesValue = Record<string, number[][]>;
type SourceMeshValue = Awaited<ReturnType<typeof readWarehouseGlb>>[number];

const BOX_TRIANGLES = 12;
const MILLIMETERS = 1000;

const readPart = (parts: SourceMeshValue[], material: string, count: number): TriangleValue[] => {
  const triangles = parts.find(part => part.material === material)?.triangles;

  if (triangles?.length !== count) {
    throw new Error(`Warehouse shell: unexpected triangle count for ${material}`);
  }

  return triangles;
};

const appendBoxes = (batch: number[][], triangles: TriangleValue[], fit: PointValue): void => {
  for (let index = 0; index < triangles.length; index += BOX_TRIANGLES) {
    const points = triangles.slice(index, index + BOX_TRIANGLES).flat().map(fit);
    const bounds = new Box3().setFromPoints(points);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const isCorner = ({ x, y, z }: Vector3): boolean => (
      Math.min(Math.abs(x - bounds.min.x), Math.abs(x - bounds.max.x)) < 0.001
      && Math.min(Math.abs(y - bounds.min.y), Math.abs(y - bounds.max.y)) < 0.001
      && Math.min(Math.abs(z - bounds.min.z), Math.abs(z - bounds.max.z)) < 0.001
    );

    if (points.length !== 3 * BOX_TRIANGLES || !points.every(isCorner) || size.x <= 0 || size.y <= 0 || size.z <= 0) {
      throw new Error('Warehouse shell: expected an axis-aligned box');
    }

    batch.push([...center.toArray(), ...size.toArray()].map(value => Math.round(value * MILLIMETERS)));
  }
};

const [, , shelterPath, bumperPath, levellerPath, wallPath, outputPath] = process.argv;

if (shelterPath === undefined || bumperPath === undefined || levellerPath === undefined
  || wallPath === undefined || outputPath === undefined) {
  throw new Error('Usage: node convertWarehouseShell.ts <shelter.glb> <bumper.glb> <leveller.glb> <wall.glb> <output.json>');
}

const wallTexture = new Texture();
const wallLoader = new GLTFLoader().register(() => ({
  loadTexture: (): Promise<Texture> => Promise.resolve(wallTexture),
  name: 'EXT_texture_webp',
}));
const [shelter, bumper, leveller, cladding] = await Promise.all([
  readWarehouseGlb(shelterPath),
  readWarehouseGlb(bumperPath),
  readWarehouseGlb(levellerPath),
  readWarehouseGlb(wallPath, wallLoader),
]);
wallTexture.dispose();
const dock = { buildingRoofAlt: [], road: [], warehouseRoof: [], warehouseWall: [], windowGlass: [] } satisfies ShellBatchesValue;
const wall = { warehouseRoof: [], warehouseWall: [], windowGlass: [] } satisfies ShellBatchesValue;
const fitShelter: PointValue = ({ x, y, z }) => new Vector3(x * 0.67, y * 0.54, -z * 0.73);
const fitBumper: PointValue = ({ x, y, z }) => new Vector3(x + Math.sign(x) * 0.15, y, 0.04 - z);
const fitLeveller: PointValue = ({ x, y, z }) => new Vector3(x * 0.77, y * (0.32 / 0.18), 0.197 - z * (0.65 / 2.925));
const fitWall: PointValue = ({ x, y, z }) => new Vector3(x, y / 3, z);

appendBoxes(dock.warehouseWall, readPart(shelter, 'paint', 36), fitShelter);
appendBoxes(dock.windowGlass, readPart(shelter, 'charcoal', 36), fitShelter);
appendBoxes(dock.buildingRoofAlt, readPart(shelter, 'yellow', 24), fitShelter);
appendBoxes(dock.warehouseRoof, readPart(shelter, 'steel', 36).slice(0, 12), fitShelter);
const steel = readPart(bumper, 'steel', 152);
appendBoxes(dock.warehouseRoof, [...steel.slice(0, 12), ...steel.slice(76, 88)], fitBumper);
appendBoxes(dock.road, readPart(bumper, 'rubber', 24), fitBumper);
appendBoxes(dock.buildingRoofAlt, readPart(bumper, 'yellow', 24), fitBumper);
appendBoxes(dock.road, readPart(leveller, 'charcoal', 12), fitLeveller);
appendBoxes(dock.warehouseRoof, readPart(leveller, 'steel', 24), fitLeveller);
appendBoxes(dock.buildingRoofAlt, readPart(leveller, 'yellow', 48).slice(0, 36), fitLeveller);
appendBoxes(wall.warehouseRoof, readPart(cladding, 'concrete', 12), fitWall);
appendBoxes(wall.warehouseWall, readPart(cladding, 'paint', 120), fitWall);
appendBoxes(wall.warehouseRoof, readPart(cladding, 'blue', 12), fitWall);
appendBoxes(wall.windowGlass, readPart(cladding, 'charcoal', 12), fitWall);

await writeFile(outputPath, `{
  "dock": ${JSON.stringify(dock)},
  "wall": ${JSON.stringify(wall)}
}\n`);
