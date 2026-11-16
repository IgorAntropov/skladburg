import { writeFile } from 'node:fs/promises';
import {
  Box3,
  BoxGeometry,
  Matrix4,
  Vector3,
} from 'three';

import type {
  MeshValue,
  TriangleValue,
} from './warehouseModelGeometry.ts';

import {
  readTriangles,
  readWarehouseGlb,
  toWarehouseMesh,
} from './warehouseModelGeometry.ts';

interface PartValue {
  bounds: Box3;
  material: string;
  triangles: TriangleValue[];
}

const splitParts = (triangles: TriangleValue[], material: string): PartValue[] => {
  const vertexTriangles = new Map<Vector3, TriangleValue[]>();

  for (const triangle of triangles) {
    for (const point of triangle) {
      const connected = vertexTriangles.get(point) ?? [];

      connected.push(triangle);
      vertexTriangles.set(point, connected);
    }
  }

  const remaining = new Set(triangles);
  const parts: PartValue[] = [];

  for (const triangle of triangles) {
    if (!remaining.delete(triangle)) {
      continue;
    }

    const bounds = new Box3();
    const connected = [triangle];

    for (const current of connected) {
      for (const vertex of current) {
        bounds.expandByPoint(vertex);

        for (const neighbor of vertexTriangles.get(vertex) ?? []) {
          if (remaining.delete(neighbor)) {
            connected.push(neighbor);
          }
        }
      }
    }

    parts.push({ bounds, material, triangles: connected });
  }

  return parts;
};

const readAsset = async (path: string): Promise<PartValue[]> => {
  const meshes = await readWarehouseGlb(path);

  return meshes.flatMap(mesh => splitParts(mesh.triangles, mesh.material));
};

const wholeBounds = (parts: readonly PartValue[]): Box3 => {
  const bounds = new Box3();

  for (const part of parts) {
    bounds.union(part.bounds);
  }

  return bounds;
};

const boxTriangles = (bounds: Box3): TriangleValue[] => {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const geometry = new BoxGeometry(size.x, size.y, size.z);
  const triangles = readTriangles(geometry, new Matrix4().makeTranslation(center));

  geometry.dispose();

  return triangles;
};

const frameMeshes = (parts: PartValue[]): { rackFrame: MeshValue; rackFrameLow: MeshValue } => {
  const bounds = wholeBounds(parts);
  const posts: PartValue[] = [];
  const plates: PartValue[] = [];
  const braces: PartValue[] = [];
  const sleeves: PartValue[] = [];

  for (const part of parts) {
    const size = part.bounds.getSize(new Vector3());

    if (part.material === 'metal' && size.y > 3) {
      posts.push(part);
    }
    else if (part.material === 'metal' && size.z > 0.5) {
      braces.push(part);
    }
    else if (part.material === 'dark' && size.z > 0.1) {
      plates.push(part);
    }
    else if (part.material === 'accent') {
      sleeves.push(part);
    }
  }

  const lowerDiagonal = braces.find(part => part.bounds.max.y - part.bounds.min.y > 0.5);

  if (posts.length !== 2 || plates.length !== 2 || braces.length !== 13 || sleeves.length !== 2 || lowerDiagonal === undefined) {
    throw new Error('Warehouse kit: unexpected upright frame parts');
  }

  const postTriangles = posts.flatMap(part => boxTriangles(part.bounds));
  const plateTriangles = plates.flatMap(part => boxTriangles(part.bounds));
  const braceTriangles = braces.flatMap(part => part.triangles);
  const sleeveTriangles = sleeves.flatMap(part => part.triangles);
  const lowPlateTriangles = plates.flatMap((part) => {
    const plate = part.bounds.clone();
    plate.min.x = bounds.min.x;
    plate.max.x = bounds.max.x;

    return boxTriangles(plate);
  });

  return {
    rackFrame: toWarehouseMesh([...postTriangles, ...plateTriangles, ...braceTriangles, ...sleeveTriangles], bounds),
    rackFrameLow: toWarehouseMesh([...postTriangles, ...lowPlateTriangles, ...lowerDiagonal.triangles], bounds),
  };
};

const levelMeshes = (parts: PartValue[]): {
  rackDeck: MeshValue;
  rackDeckLow: MeshValue;
  rackRail: MeshValue;
  rackRailLow: MeshValue;
} => {
  const boards: PartValue[] = [];
  const beams: PartValue[] = [];
  const fittings: PartValue[] = [];

  for (const part of parts) {
    const size = part.bounds.getSize(new Vector3());

    if (part.material === 'surface') {
      boards.push(part);
    }
    else if (part.material === 'accent' && size.y > 0.08) {
      beams.push(part);
    }
    else if (part.material === 'metal' && (size.y > 0.1 || size.x > 1)) {
      fittings.push(part);
    }
  }

  if (boards.length !== 3 || beams.length !== 2 || fittings.length !== 6) {
    throw new Error('Warehouse kit: unexpected beam level parts');
  }

  const bounds = wholeBounds([...boards, ...beams, ...fittings]);
  const lowBeams = beams.flatMap((part) => {
    const beam = part.bounds.clone();
    beam.min.x = bounds.min.x;
    beam.max.x = bounds.max.x;
    beam.max.y = bounds.max.y;

    if (beam.max.z < 0) {
      beam.min.z = bounds.min.z;
    }
    else {
      beam.max.z = bounds.max.z;
    }

    return boxTriangles(beam);
  });

  return {
    rackDeck: toWarehouseMesh(boards.flatMap(part => boxTriangles(part.bounds)), bounds),
    rackDeckLow: toWarehouseMesh(boxTriangles(wholeBounds(boards)), bounds),
    rackRail: toWarehouseMesh([...beams, ...fittings].flatMap(part => boxTriangles(part.bounds)), bounds),
    rackRailLow: toWarehouseMesh(lowBeams, bounds),
  };
};

const palletMeshes = (parts: PartValue[]): { palletBase: MeshValue; palletBoards: MeshValue; palletLoad: MeshValue } => {
  const bounds = wholeBounds(parts);
  const byMaterial = (material: string): MeshValue => toWarehouseMesh(
    parts.filter(part => part.material === material).flatMap(part => part.triangles),
    bounds,
  );

  return {
    palletBase: byMaterial('steel'),
    palletBoards: byMaterial('white'),
    palletLoad: byMaterial('paint'),
  };
};

const [uprightPath, deckPath, palletPath] = process.argv.slice(2);

if (uprightPath === undefined || deckPath === undefined || palletPath === undefined || process.argv.length !== 5) {
  throw new Error('Usage: node apps/web/build-models/convertWarehouseKit.ts <upright.glb> <deck.glb> <pallet.glb>');
}

const [upright, deck, pallet] = await Promise.all([
  readAsset(uprightPath),
  readAsset(deckPath),
  readAsset(palletPath),
]);
const kit = {
  ...frameMeshes(upright),
  ...levelMeshes(deck),
  ...palletMeshes(pallet),
};
const output = new URL('../src/pages/warehouse/scene/warehouseKit.json', import.meta.url);

await writeFile(output, `{
${Object.entries(kit).map(([key, mesh]) => `  "${key}": ${JSON.stringify(mesh)}`).join(',\n')}
}\n`);
