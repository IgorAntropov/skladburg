import {
  createContext,
  useContext,
} from 'react';

const MotionFeaturesContext = createContext(false);

export const MotionFeaturesProvider = MotionFeaturesContext.Provider;

export const useAreMotionFeaturesLoaded = (): boolean => useContext(MotionFeaturesContext);
