import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { useSceneCameraStore } from './useSceneCameraStore';

describe('useSceneCameraStore', () => {
  beforeEach(() => {
    useSceneCameraStore.setState({ command: undefined, isCameraReady: false });
  });

  it('drops the command while the camera is not ready', () => {
    useSceneCameraStore.getState().sendCommand({ kind: 'home' });

    expect(useSceneCameraStore.getState().command).toBeUndefined();
  });

  it('numbers the commands one by one', () => {
    const { sendCommand, setCameraReady } = useSceneCameraStore.getState();
    setCameraReady(true);

    sendCommand({ kind: 'home' });
    const first = useSceneCameraStore.getState().command;
    sendCommand({ direction: 1, kind: 'rotate' });
    const second = useSceneCameraStore.getState().command;
    sendCommand({ direction: 1, kind: 'rotate' });
    const third = useSceneCameraStore.getState().command;

    expect(first).toEqual({ id: 1, value: { kind: 'home' } });
    expect(second).toEqual({ id: 2, value: { direction: 1, kind: 'rotate' } });
    expect(third?.id).toBe(3);
    expect(third).not.toBe(second);
  });

  it('keeps the numbering when the camera leaves and comes back', () => {
    const { sendCommand, setCameraReady } = useSceneCameraStore.getState();
    setCameraReady(true);
    sendCommand({ kind: 'home' });
    setCameraReady(false);
    sendCommand({ kind: 'home' });
    setCameraReady(true);

    sendCommand({ kind: 'home' });

    expect(useSceneCameraStore.getState().command?.id).toBe(2);
  });
});
