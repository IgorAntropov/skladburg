import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';
import { PlaneGeometry } from 'three';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useWorldGlowMaterial,
} from '@/shared/3d';

import type { WindowInstancesValue } from '../night';

import { attachGlowDelays } from '../geometry/createGlowDelayGeometry';
import { WINDOW_GLOW_SPEC } from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';

interface NetworkWindowsProps {
  level: QualityLevelValue;
  windows: WindowInstancesValue;
}

export const NetworkWindows = ({ level, windows }: NetworkWindowsProps): ReactElement => {
  const { decorDensity } = QUALITY_LEVEL_SETTINGS[level];
  const material = useWorldGlowMaterial(WINDOW_GLOW_SPEC);
  const geometry = useMemo(() => attachGlowDelays(new PlaneGeometry(1, 1), windows.delays), [windows.delays]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <InstancedLayer
      count={windows.getVisibleCount(decorDensity)}
      delays={undefined}
      geometry={geometry}
      hasShadowCast={false}
      hasShadowReceive={false}
      material={material}
      matrices={windows.matrices}
      tints={undefined}
    />
  );
};
