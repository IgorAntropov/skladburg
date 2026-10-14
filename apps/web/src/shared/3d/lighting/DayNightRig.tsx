import type { ReactElement } from 'react';
import type {
  DirectionalLight,
  HemisphereLight,
} from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Object3D } from 'three';

import type { QualityLevelValue } from '../quality/qualityLevel';
import type { SceneWorldValue } from '../world/sceneWorld';
import type { ShadowMapSizeValue } from './shadowSettings';

import { useWorldPalette } from '../materials/useWorldPalette';
import { QUALITY_LEVEL_SETTINGS } from '../quality/qualityLevel';
import { setSceneBackground } from '../world/setSceneBackground';
import {
  computeDayNightLighting,
  createDayNightLightingValue,
} from './computeDayNightLighting';
import { computeShadowFrustum } from './computeShadowFrustum';
import { createDayNightTween } from './createDayNightTween';
import { DAY_NIGHT_TRANSITION_MS } from './dayNightKeyframes';
import {
  markShadowMapStale,
  releaseShadowMap,
  useShadowMapRefresh,
} from './shadowMapRefresh';
import { SHADOW_SETTINGS_BY_MAP_SIZE } from './shadowSettings';

interface DayNightRigProps {
  isNight: boolean;
  isReducedMotion: boolean;
  level: QualityLevelValue;
  shadowMapSize: ShadowMapSizeValue;
  world: SceneWorldValue;
}

export const DayNightRig = ({
  isNight,
  isReducedMotion,
  level,
  shadowMapSize,
  world,
}: DayNightRigProps): ReactElement => {
  const palette = useWorldPalette();
  const scene = useThree(state => state.scene);
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);
  const refreshShadowMap = useShadowMapRefresh();

  const lightRef = useRef<DirectionalLight>(null);
  const hemisphereRef = useRef<HemisphereLight>(null);
  const previousIsNightRef = useRef(isNight);
  const isTransitionActiveRef = useRef(false);

  const [lighting] = useState(createDayNightLightingValue);
  const [shadowTarget] = useState(() => new Object3D());
  const [tween] = useState(() => createDayNightTween({
    durationMs: DAY_NIGHT_TRANSITION_MS,
    initialValue: isNight ? 1 : 0,
  }));

  const frustum = useMemo(() => computeShadowFrustum(world), [world]);
  const isShadowEnabled = QUALITY_LEVEL_SETTINGS[level].hasShadows;

  const applyLighting = useCallback((): void => {
    computeDayNightLighting(tween.value, palette, lighting);

    const light = lightRef.current;
    const hemisphere = hemisphereRef.current;

    if (light === null || hemisphere === null) {
      return;
    }

    hemisphere.color.copy(lighting.hemisphereSky);
    hemisphere.groundColor.copy(lighting.hemisphereGround);
    hemisphere.intensity = lighting.hemisphereIntensity;
    light.color.copy(lighting.lightColor);
    light.intensity = lighting.lightIntensity;
    light.shadow.intensity = lighting.shadowIntensity;
    light.position.set(
      frustum.centerX + lighting.lightDirection.x * frustum.distance,
      frustum.centerY + lighting.lightDirection.y * frustum.distance,
      frustum.centerZ + lighting.lightDirection.z * frustum.distance,
    );
  }, [frustum, lighting, palette, tween]);

  useLayoutEffect(() => {
    const light = lightRef.current;

    if (light === null) {
      return;
    }

    light.target = shadowTarget;
  }, [shadowTarget]);

  useLayoutEffect(() => {
    const light = lightRef.current;

    if (light === null) {
      return;
    }

    const { bias, normalBias, radius } = SHADOW_SETTINGS_BY_MAP_SIZE[shadowMapSize];

    releaseShadowMap(light);
    light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    light.shadow.bias = bias;
    light.shadow.normalBias = normalBias;
    light.shadow.radius = radius;
    refreshShadowMap();
  }, [refreshShadowMap, shadowMapSize]);

  useLayoutEffect(() => {
    setSceneBackground(scene, lighting.background);

    return () => {
      setSceneBackground(scene, null);
    };
  }, [lighting, scene]);

  useLayoutEffect(() => {
    const light = lightRef.current;

    if (light === null) {
      return;
    }

    const { camera } = light.shadow;

    shadowTarget.position.set(frustum.centerX, frustum.centerY, frustum.centerZ);
    shadowTarget.updateMatrixWorld();
    camera.left = -frustum.halfExtent;
    camera.right = frustum.halfExtent;
    camera.top = frustum.halfExtent;
    camera.bottom = -frustum.halfExtent;
    camera.near = frustum.near;
    camera.far = frustum.far;
    camera.updateProjectionMatrix();
  }, [frustum, shadowTarget]);

  useLayoutEffect(() => {
    applyLighting();
    refreshShadowMap();
  }, [applyLighting, refreshShadowMap]);

  useEffect(() => {
    const light = lightRef.current;

    if (!isShadowEnabled && light !== null) {
      releaseShadowMap(light);
    }

    refreshShadowMap();
  }, [isShadowEnabled, refreshShadowMap]);

  useEffect(() => {
    if (previousIsNightRef.current === isNight) {
      return;
    }

    previousIsNightRef.current = isNight;

    const target = isNight ? 1 : 0;

    console.log('> DayNightRig -> setTarget:', { isInstant: isReducedMotion, target });
    tween.setTarget(target, performance.now(), isReducedMotion);

    if (isReducedMotion) {
      applyLighting();
      refreshShadowMap();

      return;
    }

    isTransitionActiveRef.current = true;
    invalidate();
  }, [applyLighting, invalidate, isNight, isReducedMotion, refreshShadowMap, tween]);

  useFrame(() => {
    const isMoving = tween.advance(performance.now());

    if (!isMoving && !isTransitionActiveRef.current) {
      return;
    }

    isTransitionActiveRef.current = isMoving;
    applyLighting();
    markShadowMapStale(gl);

    if (isMoving) {
      invalidate();
    }
  });

  return (
    <>
      <primitive object={shadowTarget} />
      <hemisphereLight ref={hemisphereRef} />
      <directionalLight castShadow={isShadowEnabled} ref={lightRef} />
    </>
  );
};
