import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import {
  useEffect,
  useMemo,
} from 'react';
import { MeshBasicMaterial } from 'three';

import type {
  QualityLevelValue,
  TerrainDecorValue,
  WorldTerrainValue,
} from '@/shared/3d';

import {
  getDecorCountForDensity,
  QUALITY_LEVEL_SETTINGS,
  useWorldGlowMaterial,
} from '@/shared/3d';

import type { SoftBlobOptionsValue } from '../geometry/createSoftBlobGeometry';
import type { NetworkSceneBuildingValue } from '../layout';

import {
  BLOB_POLYGON_OFFSET,
  BUILDING_BLOB_OPACITY,
  BUILDING_BLOB_OPTIONS,
  BUILDING_BLOB_SHADOWED_OPACITY,
  TREE_BLOB_OPACITY,
  TREE_BLOB_OPTIONS,
} from '../geometry/blobConstants';
import {
  buildBuildingBlobMatrices,
  buildTreeBlobs,
} from '../geometry/buildBlobMatrices';
import { createSoftBlobGeometry } from '../geometry/createSoftBlobGeometry';
import { getVisibleBuildingCount } from '../layout';
import { InstancedLayer } from './InstancedLayer';

interface NetworkShadowBlobsProps {
  buildings: readonly NetworkSceneBuildingValue[];
  level: QualityLevelValue;
  terrain: WorldTerrainValue;
}

interface NetworkTreeBlobsProps {
  decor: readonly TerrainDecorValue[];
  density: number;
}

const BLOB_COLOR_SPEC = { key: 'windowGlass', kind: 'unlit' } as const;

const useBlobMaterial = (opacity: number): MeshBasicMaterial => {
  const colorSource = useWorldGlowMaterial(BLOB_COLOR_SPEC);
  const material = useMemo((): MeshBasicMaterial => {
    const created = new MeshBasicMaterial({
      depthWrite: false,
      opacity,
      polygonOffset: true,
      polygonOffsetFactor: BLOB_POLYGON_OFFSET,
      polygonOffsetUnits: BLOB_POLYGON_OFFSET,
      toneMapped: false,
      transparent: true,
      vertexColors: true,
    });

    created.color = colorSource.color;

    return created;
  }, [colorSource, opacity]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return material;
};

const useBlobGeometry = (options: SoftBlobOptionsValue): BufferGeometry => {
  const geometry = useMemo(() => createSoftBlobGeometry(options), [options]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return geometry;
};

const NetworkTreeBlobs = ({ decor, density }: NetworkTreeBlobsProps): ReactElement => {
  const material = useBlobMaterial(TREE_BLOB_OPACITY);
  const geometry = useBlobGeometry(TREE_BLOB_OPTIONS);
  const trees = useMemo(() => buildTreeBlobs(decor), [decor]);

  return (
    <InstancedLayer
      count={getDecorCountForDensity(trees.ranks, density)}
      delays={undefined}
      geometry={geometry}
      hasShadowCast={false}
      hasShadowReceive={false}
      material={material}
      matrices={trees.matrices}
      tints={undefined}
    />
  );
};

export const NetworkShadowBlobs = ({ buildings, level, terrain }: NetworkShadowBlobsProps): ReactElement => {
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const material = useBlobMaterial(hasShadows ? BUILDING_BLOB_SHADOWED_OPACITY : BUILDING_BLOB_OPACITY);
  const geometry = useBlobGeometry(BUILDING_BLOB_OPTIONS);
  const matrices = useMemo(() => buildBuildingBlobMatrices(buildings), [buildings]);
  const hasTreeBlobs = level !== 'low';

  return (
    <>
      <InstancedLayer
        count={getVisibleBuildingCount(buildings, decorDensity)}
        delays={undefined}
        geometry={geometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={material}
        matrices={matrices}
        tints={undefined}
      />
      {hasTreeBlobs && <NetworkTreeBlobs decor={terrain.decor} density={decorDensity} />}
    </>
  );
};
