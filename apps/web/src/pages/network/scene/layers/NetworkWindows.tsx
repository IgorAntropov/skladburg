import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  Group,
} from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PlaneGeometry } from 'three';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useDayNightValue,
  useWorldGlowMaterial,
} from '@/shared/3d';

import type { WindowSetsValue } from '../night';

import { attachGlowDelays } from '../geometry/createGlowDelayGeometry';
import { readCameraZoom } from '../geometry/readCameraZoom';
import {
  createWindowViewState,
  updateWindowViewState,
} from '../night/windowViewState';
import { WINDOW_GLOW_SPEC } from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';

interface NetworkWindowsProps {
  level: QualityLevelValue;
  windows: WindowSetsValue;
}

const writeSetVisibility = (near: Group | null, far: Group | null, isFarSet: boolean): void => {
  if (near !== null) {
    near.visible = !isFarSet;
  }

  if (far !== null) {
    far.visible = isFarSet;
  }
};

const useWindowGeometry = (delays: Float32Array): BufferGeometry => {
  const geometry = useMemo(() => attachGlowDelays(new PlaneGeometry(1, 1), delays), [delays]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return geometry;
};

export const NetworkWindows = ({ level, windows }: NetworkWindowsProps): ReactElement => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const dayNight = useDayNightValue();
  const { decorDensity } = QUALITY_LEVEL_SETTINGS[level];
  const material = useWorldGlowMaterial(WINDOW_GLOW_SPEC);
  const nearGeometry = useWindowGeometry(windows.near.delays);
  const farGeometry = useWindowGeometry(windows.far.delays);

  const nearGroupRef = useRef<Group>(null);
  const farGroupRef = useRef<Group>(null);
  const [view] = useState(createWindowViewState);

  useFrame((state) => {
    if (updateWindowViewState(view, readCameraZoom(state.camera), dayNight.value)) {
      writeSetVisibility(nearGroupRef.current, farGroupRef.current, view.isFarSet);
    }
  });

  useLayoutEffect(() => {
    updateWindowViewState(view, readCameraZoom(camera), dayNight.value);
    writeSetVisibility(nearGroupRef.current, farGroupRef.current, view.isFarSet);
    invalidate();
  }, [camera, dayNight, invalidate, view]);

  return (
    <>
      <group ref={nearGroupRef}>
        <InstancedLayer
          count={windows.near.getVisibleCount(decorDensity)}
          delays={undefined}
          geometry={nearGeometry}
          hasShadowCast={false}
          hasShadowReceive={false}
          material={material}
          matrices={windows.near.matrices}
          tints={undefined}
        />
      </group>
      <group ref={farGroupRef}>
        <InstancedLayer
          count={windows.far.getVisibleCount(decorDensity)}
          delays={undefined}
          geometry={farGeometry}
          hasShadowCast={false}
          hasShadowReceive={false}
          material={material}
          matrices={windows.far.matrices}
          tints={undefined}
        />
      </group>
    </>
  );
};
