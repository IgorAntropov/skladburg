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
import { resolveSelectionFrame } from '../geometry/selectionFrame';
import {
  SELECTION_CORNER_INSTANCE_COUNT,
  writeSelectionCorners,
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
  selectedId: string | undefined;
}

const MATRICES_LENGTH = SELECTION_CORNER_INSTANCE_COUNT * INSTANCE_MATRIX_ITEM_SIZE;

export const NetworkSelectionCorners = ({
  boxGeometry,
  buildings,
  cities,
  selectedId,
}: NetworkSelectionCornersProps): null | ReactElement => {
  const invalidate = useThree(state => state.invalidate);

  const lightMaterial = useWorldGlowMaterial(UNLIT_RIM_SPEC);
  const darkMaterial = useWorldGlowMaterial(UNLIT_ROAD_SPEC);

  const groupRef = useRef<Group>(null);
  const frameRef = useRef<SelectionFrameValue | undefined>(undefined);
  const animationRef = useRef<CornerAnimationValue>(createCornerAnimation(false));

  const frame = useMemo(() => resolveSelectionFrame(buildings, cities, selectedId), [buildings, cities, selectedId]);
  const lightMatrices = useMemo(() => new Float32Array(MATRICES_LENGTH), []);
  const darkMatrices = useMemo(() => new Float32Array(MATRICES_LENGTH), []);

  useFrame((_, delta) => {
    const animation = animationRef.current;
    const currentFrame = frameRef.current;

    if (!isCornerAnimationRunning(animation) || currentFrame === undefined) {
      return;
    }

    writeSelectionCorners(currentFrame, stepCornerAnimation(animation, delta), lightMatrices, darkMatrices);
    markInstanceMatricesUpdated(groupRef.current);

    if (isCornerAnimationRunning(animation)) {
      invalidate();
    }
  });

  useLayoutEffect(() => {
    frameRef.current = frame;

    if (frame === undefined) {
      animationRef.current = createCornerAnimation(false);

      return;
    }

    const isMotionReduced = readPrefersReducedMotion();

    animationRef.current = createCornerAnimation(!isMotionReduced);
    writeSelectionCorners(
      frame,
      isMotionReduced ? 0 : CORNER_APPEAR_OFFSET_METERS,
      lightMatrices,
      darkMatrices,
    );
    markInstanceMatricesUpdated(groupRef.current);
    invalidate();
  }, [darkMatrices, frame, invalidate, lightMatrices]);

  if (frame === undefined) {
    return null;
  }

  return (
    <group ref={groupRef}>
      <InstancedLayer
        count={SELECTION_CORNER_INSTANCE_COUNT}
        delays={undefined}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={darkMaterial}
        matrices={darkMatrices}
        tints={undefined}
      />
      <InstancedLayer
        count={SELECTION_CORNER_INSTANCE_COUNT}
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
