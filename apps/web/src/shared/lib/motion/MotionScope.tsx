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
  useRef,
  useState,
} from 'react';

import { loadMotionFeatures } from './loadMotionFeatures';
import { MotionFeaturesProvider } from './MotionFeaturesContext';

interface MotionScopeProps {
  children: ReactNode;
}

const NEVER_LOADED_FEATURES: Promise<FeatureBundle> = new Promise<FeatureBundle>(() => undefined);

export const MotionScope = ({ children }: MotionScopeProps): ReactElement => {
  const [areFeaturesLoaded, setAreFeaturesLoaded] = useState(false);
  const isFailureReportedRef = useRef(false);

  const handleFeaturesLoad = useCallback(async (): Promise<FeatureBundle> => {
    try {
      const features = await loadMotionFeatures();

      setAreFeaturesLoaded(true);

      return features;
    }
    catch (error) {
      if (!isFailureReportedRef.current) {
        isFailureReportedRef.current = true;
        console.error('> MotionScope -> loadFeatures:', { error });
      }

      return NEVER_LOADED_FEATURES;
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={handleFeaturesLoad} strict>
        <MotionFeaturesProvider value={areFeaturesLoaded}>{children}</MotionFeaturesProvider>
      </LazyMotion>
    </MotionConfig>
  );
};
