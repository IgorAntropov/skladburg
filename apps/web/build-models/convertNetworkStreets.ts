import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import type { VertexStyleValue } from './createVertexStyleResolver.ts';
import type { GlbMeshValue } from './parseGlb.ts';

import { encodeWorldModelShade } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { createVertexStyleResolver } from './createVertexStyleResolver.ts';
import { decodePng } from './decodePng.ts';
import { parseGlb } from './parseGlb.ts';
import { prepareModel } from './prepareModel.ts';
import { writeWorldModel } from './writeWorldModel.ts';

const keepLamp = (mesh: GlbMeshValue): GlbMeshValue => {
  const indices: number[] = [];

  for (let corner = 0; corner < mesh.indices.length; corner += 3) {
    const triangle = mesh.indices.slice(corner, corner + 3);
    const isAtRoadside = triangle.every(vertex => (mesh.positions[vertex * 3] ?? 0) > 0.395);
    const isAboveSidewalk = triangle.some(vertex => (mesh.positions[vertex * 3 + 1] ?? 0) > 0.051);

    if (isAtRoadside && isAboveSidewalk) {
      indices.push(...triangle);
    }
  }

  return { ...mesh, indices: Uint32Array.from(indices) };
};

const removeRoadEnds = (mesh: GlbMeshValue): GlbMeshValue => {
  const indices: number[] = [];

  for (let corner = 0; corner < mesh.indices.length; corner += 3) {
    const triangle = mesh.indices.slice(corner, corner + 3);
    const z = mesh.positions[(triangle[0] ?? 0) * 3 + 2] ?? 0;
    const isEndFace = Math.abs(z) > 0.499 && triangle.every(vertex => mesh.positions[vertex * 3 + 2] === z);

    if (!isEndFace) {
      indices.push(...triangle);
    }
  }

  return { ...mesh, indices: Uint32Array.from(indices) };
};

const keepTree = (mesh: GlbMeshValue): GlbMeshValue => {
  const indices: number[] = [];
  const normals = mesh.normals.slice();

  for (let corner = 0; corner < mesh.indices.length; corner += 3) {
    const triangle = mesh.indices.slice(corner, corner + 3);
    const heights = Array.from(triangle, vertex => mesh.positions[vertex * 3 + 1] ?? 0);
    const isTrunkOrLowerCrown = heights.every(height => height >= 0.045 && height <= 0.321)
      && heights.some(height => height > 0.075 && height < 0.31);
    const isCrownCap = heights.every(height => height > 0.319 && height < 0.321)
      && triangle.every(vertex => (mesh.normals[vertex * 3 + 1] ?? 0) < -0.98);
    const centerX = triangle.reduce((sum, vertex) => sum + (mesh.positions[vertex * 3] ?? 0), 0) / 3;
    const centerZ = triangle.reduce((sum, vertex) => sum + (mesh.positions[vertex * 3 + 2] ?? 0), 0) / 3;

    if (centerX > 0 && centerZ < 0.03) {
      if (isCrownCap) {
        for (const vertex of triangle) {
          normals[vertex * 3 + 1] = 1;
        }
      }

      if (isTrunkOrLowerCrown || isCrownCap) {
        indices.push(...triangle);
      }
    }
  }

  return { ...mesh, indices: Uint32Array.from(indices), normals };
};

const thinParkTrees = (mesh: GlbMeshValue): GlbMeshValue => {
  const indices: number[] = [];

  for (let corner = 0; corner < mesh.indices.length; corner += 3) {
    const triangle = mesh.indices.slice(corner, corner + 3);
    const isGround = triangle.every(vertex => (mesh.positions[vertex * 3 + 1] ?? 0) < 0.051);
    const isNorthEastTree = triangle.every(vertex => (mesh.positions[vertex * 3] ?? 0) > 0.04
      && (mesh.positions[vertex * 3 + 2] ?? 0) < 0.055);
    const isSouthWestTree = triangle.every(vertex => (mesh.positions[vertex * 3] ?? 0) < 0.02
      && (mesh.positions[vertex * 3 + 2] ?? 0) > 0.08);

    if (isGround || isNorthEastTree || isSouthWestTree) {
      indices.push(...triangle);
    }
  }

  return { ...mesh, indices: Uint32Array.from(indices) };
};

const [, , source, output] = process.argv;
if (source === undefined || output === undefined) {
  throw new Error('Usage: node convertNetworkStreets.ts <Kenney models directory> <output directory>');
}

const style = createVertexStyleResolver(decodePng(await readFile(join(source, 'Textures', 'colormap.png'))));
const roadStyle = (u: number, v: number): VertexStyleValue => {
  const vertex = style(u, v);

  if (u > 0.13 && u < 0.18) {
    return { role: 'light', shadeByte: encodeWorldModelShade(1) };
  }
  if (u < 0.12 || u > 0.38) {
    return { role: 'dark', shadeByte: encodeWorldModelShade(0.91) };
  }
  return { ...vertex, role: 'mid' };
};
const road = removeRoadEnds(parseGlb(await readFile(join(source, 'road-straight.glb'))));
const lamp = keepLamp(parseGlb(await readFile(join(source, 'road-straight-lightposts.glb'))));
const pavement = parseGlb(await readFile(join(source, 'pavement.glb')));
const park = parseGlb(await readFile(join(source, 'grass-trees.glb')));
const tree = keepTree(park);
const treeStyle = (u: number, v: number): VertexStyleValue => ({
  role: u > 0.7 ? 'terracotta' : 'green',
  shadeByte: encodeWorldModelShade(u > 0.7 ? 1 : 0.9 + (v - 0.52) * 0.36),
});
const pavementStyle = (_u: number, v: number): VertexStyleValue => ({
  role: 'mid',
  shadeByte: encodeWorldModelShade(v > 0.88 && v < 0.92 ? 0.81 : 0.93),
});
const parkStyle = (u: number, v: number): VertexStyleValue => ({
  role: u > 0.7 ? 'terracotta' : 'green',
  shadeByte: encodeWorldModelShade(v > 0.65 && v < 0.7 ? 0.82 : 0.96),
});
const models = [
  ['network-road', road, roadStyle],
  ['network-lamp', lamp, (u: number, v: number): VertexStyleValue => ({ ...style(u, v), role: 'dark' })],
  ['network-park', thinParkTrees(park), parkStyle],
  ['network-pavement', pavement, pavementStyle],
  ['network-tree', tree, treeStyle],
] as const;
await mkdir(output, { recursive: true });
for (const [name, mesh, resolveStyle] of models) {
  const prepared = prepareModel(mesh, resolveStyle);
  const bytes = writeWorldModel(prepared);
  await writeFile(join(output, `${name}.bin`), bytes);
  console.log('> convertNetworkStreets -> write:', { bytes: bytes.length, name, triangleCount: prepared.triangleCount });
}
