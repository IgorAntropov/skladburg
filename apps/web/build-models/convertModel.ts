import type { PngImageValue } from './decodePng.ts';

import {
  readWorldModel,
  WORLD_MODEL_ROLES,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { createVertexStyleResolver } from './createVertexStyleResolver.ts';
import { parseGlb } from './parseGlb.ts';
import { prepareModel } from './prepareModel.ts';
import { writeWorldModel } from './writeWorldModel.ts';

export interface ConvertedModelValue {
  bytes: Uint8Array<ArrayBuffer>;
  report: ModelReportValue;
}

export interface ModelReportValue {
  bytes: number;
  roleHistogram: Readonly<Record<string, number>>;
  sizeSource: readonly [number, number, number];
  sizeWritten: readonly [number, number, number];
  triangles: { afterDownFaces: number; afterWeld: number; degenerate: number; flipped: number; source: number };
  vertices: { afterDownFaces: number; afterWeld: number; source: number };
}

const AXIS_COUNT = 3;

const measureSize = (positions: Float32Array): [number, number, number] => {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let index = 0; index < positions.length; index += 1) {
    const axis = index % AXIS_COUNT;

    min[axis] = Math.min(min[axis] ?? 0, positions[index] ?? 0);
    max[axis] = Math.max(max[axis] ?? 0, positions[index] ?? 0);
  }

  return [(max[0] ?? 0) - (min[0] ?? 0), (max[1] ?? 0) - (min[1] ?? 0), (max[2] ?? 0) - (min[2] ?? 0)];
};

export const convertGlbToWorldModel = (glb: Uint8Array, colormap: PngImageValue): ConvertedModelValue => {
  const prepared = prepareModel(parseGlb(glb), createVertexStyleResolver(colormap));
  const bytes = writeWorldModel(prepared);
  const written = readWorldModel(bytes.buffer);
  const roleHistogram = Object.fromEntries(WORLD_MODEL_ROLES.map(role => [role, 0]));

  for (const role of written.roles) {
    const name = WORLD_MODEL_ROLES[role] ?? 'mid';

    roleHistogram[name] = (roleHistogram[name] ?? 0) + 1;
  }

  return {
    bytes,
    report: {
      bytes: bytes.length,
      roleHistogram,
      sizeSource: prepared.stats.sourceSize,
      sizeWritten: measureSize(written.positions),
      triangles: {
        afterDownFaces: prepared.stats.sourceTriangles - prepared.stats.downFaceTriangles,
        afterWeld: prepared.triangleCount,
        degenerate: prepared.stats.degenerateTriangles,
        flipped: prepared.stats.flippedTriangles,
        source: prepared.stats.sourceTriangles,
      },
      vertices: {
        afterDownFaces: prepared.stats.keptVertices,
        afterWeld: prepared.vertexCount,
        source: prepared.stats.sourceVertices,
      },
    },
  };
};
