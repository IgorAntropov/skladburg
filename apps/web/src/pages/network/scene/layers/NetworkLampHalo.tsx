import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import { useWorldGlowMaterial } from '@/shared/3d';

import type { StreetLampsValue } from '../night';

import { attachGlowDelays } from '../geometry/createGlowDelayGeometry';
import { createLampHaloGeometry } from '../geometry/createLampLightGeometry';
import { LAMP_HALO_GLOW_SPEC } from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';

interface NetworkLampHaloProps {
  count: number;
  lamps: StreetLampsValue;
}

export const NetworkLampHalo = ({ count, lamps }: NetworkLampHaloProps): ReactElement => {
  const haloMaterial = useWorldGlowMaterial(LAMP_HALO_GLOW_SPEC);
  const haloGeometry = useMemo(() => attachGlowDelays(createLampHaloGeometry(), lamps.delays), [lamps.delays]);

  useEffect(() => {
    return () => {
      haloGeometry.dispose();
    };
  }, [haloGeometry]);

  return (
    <InstancedLayer
      count={count}
      delays={undefined}
      geometry={haloGeometry}
      hasShadowCast={false}
      hasShadowReceive={false}
      material={haloMaterial}
      matrices={lamps.haloMatrices}
      tints={undefined}
    />
  );
};
