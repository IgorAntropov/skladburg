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
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { useWorldGlowMaterial } from '@/shared/3d';

import type { CornerAnimationValue } from '../geometry/cornerAppear';
import type { SelectionFrameValue } from '../geometry/selectionFrame';
import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import {
  createCornerAnimation,
  isCornerAnimationRunning,
  stepCornerAnimation,
} from '../geometry/cornerAppear';
import { CORNER_APPEAR_OFFSET_METERS } from '../geometry/networkSceneMetrics';
import { resolveSelectionFrames } from '../geometry/selectionFrame';
import {
  SELECTION_CORNER_INSTANCE_COUNT,
  writeSelectionFrames,
} from '../geometry/writeSelectionCorners';
import { readPrefersReducedMotion } from '../motion/readPrefersReducedMotion';
import {
  UNLIT_RIM_SPEC,
  UNLIT_ROAD_SPEC,
} from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';
import { markInstanceMatricesUpdated } from './markInstanceMatricesUpdated';

interface NetworkSelectionCornersProps {
  boxGeometry: BufferGeometry;
  buildings: readonly NetworkSceneBuildingValue[];
  cities: readonly NetworkSceneCityValue[];
  selectedIds: readonly string[];
}

export const NetworkSelectionCorners = ({
  boxGeometry,
  buildings,
  cities,
  selectedIds,
}: NetworkSelectionCornersProps): null | ReactElement => {
  const invalidate = useThree(state => state.invalidate);

  const lightMaterial = useWorldGlowMaterial(UNLIT_RIM_SPEC);
  const darkMaterial = useWorldGlowMaterial(UNLIT_ROAD_SPEC);

  const groupRef = useRef<Group>(null);
  const framesRef = useRef<readonly SelectionFrameValue[]>([]);
  const animationRef = useRef<CornerAnimationValue>(createCornerAnimation(false));

  const frames = useMemo(() => resolveSelectionFrames(buildings, cities, selectedIds), [buildings, cities, selectedIds]);
  const instanceCount = frames.length * SELECTION_CORNER_INSTANCE_COUNT;
  const lightMatrices = useMemo(() => new Float32Array(instanceCount * INSTANCE_MATRIX_ITEM_SIZE), [instanceCount]);
  const darkMatrices = useMemo(() => new Float32Array(instanceCount * INSTANCE_MATRIX_ITEM_SIZE), [instanceCount]);

  useFrame((_, delta) => {
    const animation = animationRef.current;

    if (!isCornerAnimationRunning(animation)) {
      return;
    }

    writeSelectionFrames(framesRef.current, stepCornerAnimation(animation, delta), lightMatrices, darkMatrices);
    markInstanceMatricesUpdated(groupRef.current);

    if (isCornerAnimationRunning(animation)) {
      invalidate();
    }
  });

  useLayoutEffect(() => {
    framesRef.current = frames;

    if (frames.length === 0) {
      animationRef.current = createCornerAnimation(false);

      return;
    }

    const isMotionReduced = readPrefersReducedMotion();

    animationRef.current = createCornerAnimation(!isMotionReduced);
    writeSelectionFrames(
      frames,
      isMotionReduced ? 0 : CORNER_APPEAR_OFFSET_METERS,
      lightMatrices,
      darkMatrices,
    );
    markInstanceMatricesUpdated(groupRef.current);
    invalidate();
  }, [darkMatrices, frames, invalidate, lightMatrices]);

  if (frames.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      <InstancedLayer
        count={instanceCount}
        delays={undefined}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={darkMaterial}
        matrices={darkMatrices}
        tints={undefined}
      />
      <InstancedLayer
        count={instanceCount}
        delays={undefined}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={lightMaterial}
        matrices={lightMatrices}
        tints={undefined}
      />
    </group>
  );
};
