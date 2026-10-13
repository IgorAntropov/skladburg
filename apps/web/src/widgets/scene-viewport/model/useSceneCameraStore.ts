import { create } from 'zustand';

export interface SceneCameraCommandEnvelopeValue {
  id: number;
  value: SceneCameraCommandValue;
}

export type SceneCameraCommandValue
  = | { direction: SceneCameraDirectionValue; kind: 'rotate' }
    | { direction: SceneCameraDirectionValue; kind: 'zoom' }
    | { kind: 'home' };

export type SceneCameraDirectionValue = -1 | 1;

interface SceneCameraState {
  command: SceneCameraCommandEnvelopeValue | undefined;
  isCameraReady: boolean;
  sendCommand: (value: SceneCameraCommandValue) => void;
  setCameraReady: (isReady: boolean) => void;
}

export const useSceneCameraStore = create<SceneCameraState>()((set, get) => ({
  command: undefined,
  isCameraReady: false,
  sendCommand: (value) => {
    const { command, isCameraReady } = get();

    if (!isCameraReady) {
      return;
    }

    set({ command: { id: (command?.id ?? 0) + 1, value } });
  },
  setCameraReady: (isReady) => {
    set({ isCameraReady: isReady });
  },
}));
