import {
  useEffect,
  useState,
} from 'react';

import type { SkeletonTimingValue } from './skeletonTiming';

import { DEFAULT_SKELETON_TIMING } from './skeletonTiming';

export const useDelayedVisibility = (
  isActive: boolean,
  timing: SkeletonTimingValue | undefined = DEFAULT_SKELETON_TIMING,
): boolean => {
  const { delayMs, minVisibleMs } = timing;

  const [isShown, setIsShown] = useState(false);
  const [isHoldDone, setIsHoldDone] = useState(true);

  const isReadyToHide = isShown && isHoldDone && !isActive;

  if (isReadyToHide) {
    setIsShown(false);
  }

  const isVisible = isShown && (isActive || !isHoldDone);

  useEffect(() => {
    if (!isActive || isShown) {
      return undefined;
    }

    const delayTimer = setTimeout(() => {
      setIsHoldDone(false);
      setIsShown(true);
    }, delayMs);

    return () => {
      clearTimeout(delayTimer);
    };
  }, [delayMs, isActive, isShown]);

  useEffect(() => {
    if (!isShown || isHoldDone) {
      return undefined;
    }

    const holdTimer = setTimeout(() => {
      setIsHoldDone(true);
    }, minVisibleMs);

    return () => {
      clearTimeout(holdTimer);
    };
  }, [isHoldDone, isShown, minVisibleMs]);

  return isVisible;
};
