import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import { useWorldMaterial } from '@/shared/3d';

import type { NetworkSceneRoadValue } from '../layout';

import { createRoadGeometry } from '../geometry/createRoadGeometry';

interface NetworkRoadsProps {
  hasShadowReceive: boolean;
  roads: readonly NetworkSceneRoadValue[];
}

export const NetworkRoads = ({ hasShadowReceive, roads }: NetworkRoadsProps): null | ReactElement => {
  const material = useWorldMaterial('road');
  const geometry = useMemo(() => createRoadGeometry(roads), [roads]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (roads.length === 0) {
    return null;
  }

  return <mesh frustumCulled={false} geometry={geometry} material={material} receiveShadow={hasShadowReceive} />;
};
