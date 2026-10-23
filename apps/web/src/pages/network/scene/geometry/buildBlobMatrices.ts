import type { TerrainDecorValue } from '@/shared/3d';

import type { NetworkSceneBuildingValue } from '../layout';

import {
  BUILDING_BLOB_LIFT_METERS,
  BUILDING_BLOB_MARGIN_METERS,
  TREE_BLOB_CROWN_RADIUS_METERS,
  TREE_BLOB_LIFT_METERS,
  TREE_BLOB_RADIUS_SHARE,
} from './blobConstants';
import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeBoxMatrix,
  writeInstanceMatrix,
} from './composeInstanceMatrix';
import { PLAZA_HEIGHT_METERS } from './networkSceneMetrics';

export interface TreeBlobsValue {
  matrices: Float32Array;
  ranks: Float32Array;
}

interface TreeBlobDraftValue {
  diameter: number;
  rank: number;
  x: number;
  y: number;
  z: number;
}

const BLOB_THICKNESS = 1;
const DOUBLE = 2;
const X_SCALE_COS_OFFSET = 0;
const X_SCALE_SIN_OFFSET = 2;
const TRANSLATION_OFFSET = 12;

export const buildBuildingBlobMatrices = (buildings: readonly NetworkSceneBuildingValue[]): Float32Array => {
  const matrices = new Float32Array(buildings.length * INSTANCE_MATRIX_ITEM_SIZE);

  for (const [index, building] of buildings.entries()) {
    writeInstanceMatrix(matrices, index, {
      rotationY: building.rotation,
      scale: [
        building.width + DOUBLE * BUILDING_BLOB_MARGIN_METERS,
        BLOB_THICKNESS,
        building.depth + DOUBLE * BUILDING_BLOB_MARGIN_METERS,
      ],
      x: building.x,
      y: PLAZA_HEIGHT_METERS + BUILDING_BLOB_LIFT_METERS,
      z: building.z,
    });
  }

  return matrices;
};

const collectTreeDrafts = (decor: readonly TerrainDecorValue[]): TreeBlobDraftValue[] => {
  const drafts: TreeBlobDraftValue[] = [];

  for (const layer of decor) {
    if (layer.kind === 'rock') {
      continue;
    }

    const crownRadius = TREE_BLOB_CROWN_RADIUS_METERS[layer.kind];

    for (const [index, rank] of layer.ranks.entries()) {
      const offset = index * INSTANCE_MATRIX_ITEM_SIZE;
      const scaleX = Math.hypot(
        layer.matrices[offset + X_SCALE_COS_OFFSET] ?? 0,
        layer.matrices[offset + X_SCALE_SIN_OFFSET] ?? 0,
      );

      drafts.push({
        diameter: DOUBLE * crownRadius * scaleX * TREE_BLOB_RADIUS_SHARE,
        rank,
        x: layer.matrices[offset + TRANSLATION_OFFSET] ?? 0,
        y: (layer.matrices[offset + TRANSLATION_OFFSET + 1] ?? 0) + TREE_BLOB_LIFT_METERS,
        z: layer.matrices[offset + TRANSLATION_OFFSET + DOUBLE] ?? 0,
      });
    }
  }

  return drafts.toSorted((current, prev) => current.rank - prev.rank);
};

export const buildTreeBlobs = (decor: readonly TerrainDecorValue[]): TreeBlobsValue => {
  const drafts = collectTreeDrafts(decor);
  const matrices = new Float32Array(drafts.length * INSTANCE_MATRIX_ITEM_SIZE);
  const ranks = new Float32Array(drafts.length);

  for (const [index, draft] of drafts.entries()) {
    writeBoxMatrix(matrices, index, draft, { x: draft.diameter, y: BLOB_THICKNESS, z: draft.diameter });
    ranks[index] = draft.rank;
  }

  return { matrices, ranks };
};
