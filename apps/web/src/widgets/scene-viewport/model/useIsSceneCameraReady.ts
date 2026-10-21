import { useSceneCameraStore } from './useSceneCameraStore';

export const useIsSceneCameraReady = (): boolean => useSceneCameraStore(state => state.isCameraReady);
