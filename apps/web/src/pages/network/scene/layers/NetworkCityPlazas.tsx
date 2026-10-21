import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import { useWorldMaterial } from '@/shared/3d';

import type { NetworkSceneCityValue } from '../layout';

import { buildPlazaMatrices } from '../geometry/buildPlazaMatrices';
import { createPlazaGeometry } from '../geometry/createPlazaGeometry';
import { InstancedLayer } from './InstancedLayer';

interface NetworkCityPlazasProps {
  cities: readonly NetworkSceneCityValue[];
  hasShadowReceive: boolean;
}

export const NetworkCityPlazas = ({ cities, hasShadowReceive }: NetworkCityPlazasProps): ReactElement => {
  const material = useWorldMaterial('plaza');
  const geometry = useMemo(() => createPlazaGeometry(), []);
  const matrices = useMemo(() => buildPlazaMatrices(cities), [cities]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <InstancedLayer
      count={cities.length}
      delays={undefined}
      geometry={geometry}
      hasShadowCast={false}
      hasShadowReceive={hasShadowReceive}
      material={material}
      matrices={matrices}
      tints={undefined}
    />
  );
};
