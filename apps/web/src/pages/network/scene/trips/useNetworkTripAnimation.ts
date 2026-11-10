import type { RefObject } from 'react';
import type { InstancedMesh } from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

import type { NetworkTripActorValue } from '../../model/networkTripActor';
import type { NetworkTripPoseValue } from './networkTripMotion';
import type { NetworkTripPathValue } from './networkTripPath';

import { writeInstanceMatrix } from '../geometry/composeInstanceMatrix';
import { ROAD_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import { readPrefersReducedMotion } from '../motion/readPrefersReducedMotion';
import {
  advanceNetworkTripPose,
  readNetworkTripProgress,
} from './networkTripMotion';

export interface NetworkTripRenderValue {
  actor: NetworkTripActorValue;
  path: NetworkTripPathValue;
}

interface NetworkTripAnimationOptionsValue {
  body: RefObject<InstancedMesh | null>;
  decals: RefObject<InstancedMesh | null>;
  entries: readonly NetworkTripRenderValue[];
  matrices: Float32Array;
  readWorldTimeMs: () => number;
}

const FRAME_INTERVAL_MS = 80;
const REDUCED_MOTION_INTERVAL_MS = 250;
const MAX_FRAME_DELTA_SECONDS = 0.25;
const UNIT_SCALE = [1, 1, 1] as const;

export const useNetworkTripAnimation = ({
  body,
  decals,
  entries,
  matrices,
  readWorldTimeMs,
}: NetworkTripAnimationOptionsValue): void => {
  const invalidate = useThree(state => state.invalidate);
  const poses = useRef(new Map<string, NetworkTripPoseValue>());
  const transform = useRef({ rotationY: 0, scale: UNIT_SCALE, x: 0, y: ROAD_HEIGHT_METERS, z: 0 });
  const shouldContinue = useRef(false);

  const updateMatrices = useCallback((bodyMesh: InstancedMesh | null, decalsMesh: InstancedMesh | null, delta: number): void => {
    const currentTransform = transform.current;
    const worldTimeMs = readWorldTimeMs();
    let hasPendingMotion = false;

    if (bodyMesh === null) {
      return;
    }

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const pose = entry === undefined ? undefined : poses.current.get(entry.actor.id);

      if (entry === undefined || pose === undefined) {
        continue;
      }

      hasPendingMotion = advanceNetworkTripPose(entry.actor, entry.path, pose, worldTimeMs, delta) || hasPendingMotion;
      currentTransform.rotationY = pose.heading;
      currentTransform.x = pose.x;
      currentTransform.z = pose.z;

      writeInstanceMatrix(matrices, index, currentTransform);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    if (decalsMesh !== null) {
      decalsMesh.instanceMatrix.needsUpdate = true;
    }
    shouldContinue.current = hasPendingMotion;
  }, [entries, matrices, readWorldTimeMs]);

  useLayoutEffect(() => {
    const worldTimeMs = readWorldTimeMs();
    const next = new Map<string, NetworkTripPoseValue>();

    for (const { actor } of entries) {
      next.set(actor.id, poses.current.get(actor.id) ?? {
        heading: 0,
        progress: readNetworkTripProgress(actor, worldTimeMs),
        x: 0,
        z: 0,
      });
    }

    poses.current = next;
    updateMatrices(body.current, decals.current, 0);
    invalidate();
  }, [body, decals, entries, invalidate, readWorldTimeMs, updateMatrices]);

  useFrame((_, delta) => {
    if (shouldContinue.current) {
      updateMatrices(body.current, decals.current, Math.min(MAX_FRAME_DELTA_SECONDS, delta));
    }
  });

  useEffect(() => {
    if (!shouldContinue.current) {
      return undefined;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const handleTick = (): void => {
      if (shouldContinue.current) {
        invalidate();
        timer = setTimeout(handleTick, readPrefersReducedMotion() ? REDUCED_MOTION_INTERVAL_MS : FRAME_INTERVAL_MS);
      }
    };

    const handleVisibilityChange = (): void => {
      clearTimeout(timer);

      if (!document.hidden) {
        handleTick();
      }
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [invalidate, updateMatrices]);
};
