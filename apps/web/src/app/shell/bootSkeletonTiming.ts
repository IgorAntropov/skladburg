import {
  createContext,
  useContext,
} from 'react';

import type { SkeletonTimingValue } from '@/shared/ui';

import { SKELETON_MIN_VISIBLE_MS } from '@/shared/ui';

export const BOOT_SKELETON_TIMING: SkeletonTimingValue = {
  delayMs: 0,
  minVisibleMs: SKELETON_MIN_VISIBLE_MS,
};

const BootSkeletonTimingContext = createContext<SkeletonTimingValue | undefined>(undefined);

export const BootSkeletonTimingProvider = BootSkeletonTimingContext.Provider;

export const useBootSkeletonTiming = (): SkeletonTimingValue | undefined => useContext(BootSkeletonTimingContext);
