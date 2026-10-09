import type { FeatureBundle } from 'motion/react';

export const loadMotionFeatures = (): Promise<FeatureBundle> => import('./motionFeatures').then(loadedModule => loadedModule.default);
