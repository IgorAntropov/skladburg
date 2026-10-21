import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useWorldGlowMaterial,
} from '@/shared/3d';

import type { StreetLampsValue } from '../night';

import { attachGlowDelays } from '../geometry/createGlowDelayGeometry';
import { createLampPoolGeometry } from '../geometry/createLampLightGeometry';
import { LAMP_POOL_GLOW_SPEC } from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';
import { NetworkLampHalo } from './NetworkLampHalo';

interface NetworkLampLightProps {
  lamps: StreetLampsValue;
  level: QualityLevelValue;
}

export const NetworkLampLight = ({ lamps, level }: NetworkLampLightProps): ReactElement => {
  const { decorDensity, hasGlowHalo } = QUALITY_LEVEL_SETTINGS[level];
  const poolMaterial = useWorldGlowMaterial(LAMP_POOL_GLOW_SPEC);
  const poolGeometry = useMemo(() => attachGlowDelays(createLampPoolGeometry(), lamps.delays), [lamps.delays]);
  const count = lamps.getVisibleCount(decorDensity);

  useEffect(() => {
    return () => {
      poolGeometry.dispose();
    };
  }, [poolGeometry]);

  return (
    <>
      <InstancedLayer
        count={count}
        delays={undefined}
        geometry={poolGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={poolMaterial}
        matrices={lamps.poolMatrices}
        tints={undefined}
      />
      {hasGlowHalo && <NetworkLampHalo count={count} lamps={lamps} />}
    </>
  );
};
