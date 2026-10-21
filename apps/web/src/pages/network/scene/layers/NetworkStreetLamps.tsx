import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useWorldGlowMaterial,
  useWorldMaterial,
} from '@/shared/3d';

import type { StreetLampsValue } from '../night';

import { LAMP_HEAD_GLOW_SPEC } from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';

interface NetworkStreetLampsProps {
  boxGeometry: BufferGeometry;
  lamps: StreetLampsValue;
  level: QualityLevelValue;
}

export const NetworkStreetLamps = ({ boxGeometry, lamps, level }: NetworkStreetLampsProps): ReactElement => {
  const { decorDensity } = QUALITY_LEVEL_SETTINGS[level];
  const poleMaterial = useWorldMaterial('road');
  const headMaterial = useWorldGlowMaterial(LAMP_HEAD_GLOW_SPEC);
  const count = lamps.getVisibleCount(decorDensity);

  return (
    <>
      <InstancedLayer
        count={count}
        delays={undefined}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={poleMaterial}
        matrices={lamps.poleMatrices}
        tints={undefined}
      />
      <InstancedLayer
        count={count}
        delays={lamps.delays}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={headMaterial}
        matrices={lamps.headMatrices}
        tints={undefined}
      />
    </>
  );
};
