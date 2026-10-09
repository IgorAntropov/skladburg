import type { FeatureBundle } from 'motion/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  LazyMotion,
  MotionConfig,
} from 'motion/react';
import {
  useCallback,
  useState,
} from 'react';

import { loadMotionFeatures } from './loadMotionFeatures';
import { MotionFeaturesProvider } from './MotionFeaturesContext';

interface MotionScopeProps {
  children: ReactNode;
}

export const MotionScope = ({ children }: MotionScopeProps): ReactElement => {
  const [areFeaturesLoaded, setAreFeaturesLoaded] = useState(false);

  const handleFeaturesLoad = useCallback(async (): Promise<FeatureBundle> => {
    const features = await loadMotionFeatures();

    setAreFeaturesLoaded(true);

    return features;
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={handleFeaturesLoad} strict>
        <MotionFeaturesProvider value={areFeaturesLoaded}>{children}</MotionFeaturesProvider>
      </LazyMotion>
    </MotionConfig>
  );
};
