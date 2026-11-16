import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Material,
  Matrix4,
  Mesh,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface MeshValue {
  indices: number[];
  positions: number[];
}

interface PartValue {
  bounds: Box3;
  material: string;
  triangles: TriangleValue[];
}

type TriangleValue = readonly [Vector3, Vector3, Vector3];

const readTriangles = (geometry: BufferGeometry, transform: Matrix4): TriangleValue[] => {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  const vertexCount = indices?.count ?? positions.count;

  if (vertexCount % 3 !== 0) {
    throw new Error('Warehouse kit: expected triangles');
  }

  const isMirrored = transform.determinant() < 0;
  const vertices = new Map<string, Vector3>();
  const getVertex = (offset: number): Vector3 => {
    const position = new Vector3().fromBufferAttribute(positions, indices?.getX(offset) ?? offset).applyMatrix4(transform);
    const key = position.toArray().join(',');
    const previous = vertices.get(key);

    if (previous !== undefined) {
      return previous;
    }

    vertices.set(key, position);

    return position;
  };
  const triangles: TriangleValue[] = [];

  for (let offset = 0; offset < vertexCount; offset += 3) {
    const first = getVertex(offset);
    const second = getVertex(offset + 1);
    const third = getVertex(offset + 2);

    triangles.push(isMirrored ? [first, third, second] : [first, second, third]);
  }

  return triangles;
};

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

const isBufferGeometry = (geometry: unknown): geometry is BufferGeometry => geometry instanceof BufferGeometry;

const readAsset = async (loader: GLTFLoader, path: string): Promise<PartValue[]> => {
  const data = Uint8Array.from(await readFile(path));
  const { scene } = await loader.parseAsync(data.buffer, '');
  const parts: PartValue[] = [];

  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const geometry: unknown = object.geometry;
    const material: unknown = object.material;

    if (!isBufferGeometry(geometry) || !geometry.hasAttribute('position') || !(material instanceof Material)) {
      throw new Error('Warehouse kit: expected a positioned mesh with a single material');
    }

    parts.push(...splitParts(readTriangles(geometry, object.matrixWorld), material.name));
  });

  return parts;
};

const round = (value: number, scale: number): number => Math.round(value * scale) / scale;

const toMesh = (triangles: readonly TriangleValue[], bounds: Box3): MeshValue => {
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());

  if (triangles.length === 0 || size.x <= 0 || size.y <= 0 || size.z <= 0) {
    throw new Error('Warehouse kit: expected a nonempty three-dimensional module');
  }

  const mesh: MeshValue = { indices: [], positions: [] };
  const vertexIndices = new Map<string, number>();
  const edge = new Vector3();
  const normal = new Vector3();

  for (const [first, second, third] of triangles) {
    normal.subVectors(second, first).cross(edge.subVectors(third, first)).normalize();

    for (const point of [first, second, third]) {
      const position = new Vector3().subVectors(point, center).divide(size).toArray().map(value => round(value, 100_000));
      const key = [...position, ...normal.toArray().map(value => round(value, 1_000))].join(',');
      const index = vertexIndices.get(key) ?? vertexIndices.size;

      if (!vertexIndices.has(key)) {
        vertexIndices.set(key, index);
        mesh.positions.push(...position);
      }

      mesh.indices.push(index);
    }
  }

  return mesh;
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
    rackFrame: toMesh([...postTriangles, ...plateTriangles, ...braceTriangles, ...sleeveTriangles], bounds),
    rackFrameLow: toMesh([...postTriangles, ...lowPlateTriangles, ...lowerDiagonal.triangles], bounds),
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
    rackDeck: toMesh(boards.flatMap(part => boxTriangles(part.bounds)), bounds),
    rackDeckLow: toMesh(boxTriangles(wholeBounds(boards)), bounds),
    rackRail: toMesh([...beams, ...fittings].flatMap(part => boxTriangles(part.bounds)), bounds),
    rackRailLow: toMesh(lowBeams, bounds),
  };
};

const palletMeshes = (parts: PartValue[]): { palletBase: MeshValue; palletBoards: MeshValue; palletLoad: MeshValue } => {
  const bounds = wholeBounds(parts);
  const byMaterial = (material: string): MeshValue => toMesh(
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

const loader = new GLTFLoader();
const [upright, deck, pallet] = await Promise.all([
  readAsset(loader, uprightPath),
  readAsset(loader, deckPath),
  readAsset(loader, palletPath),
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
