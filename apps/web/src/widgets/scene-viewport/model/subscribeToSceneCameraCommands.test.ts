import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { subscribeToSceneCameraCommands } from './subscribeToSceneCameraCommands';
import { useSceneCameraStore } from './useSceneCameraStore';

describe('subscribeToSceneCameraCommands', () => {
  beforeEach(() => {
    useSceneCameraStore.setState({ command: undefined, isCameraReady: true });
  });

  it('hands over each new command once, in order', () => {
    const listener = vi.fn();
    subscribeToSceneCameraCommands(listener);

    useSceneCameraStore.getState().sendCommand({ direction: 1, kind: 'rotate' });
    useSceneCameraStore.getState().sendCommand({ direction: 1, kind: 'rotate' });
    useSceneCameraStore.getState().sendCommand({ kind: 'home' });

    expect(listener.mock.calls).toEqual([
      [{ direction: 1, kind: 'rotate' }],
      [{ direction: 1, kind: 'rotate' }],
      [{ kind: 'home' }],
    ]);
  });

  it('skips a command that was already in the store before the subscription', () => {
    useSceneCameraStore.getState().sendCommand({ direction: 1, kind: 'rotate' });
    const listener = vi.fn();

    subscribeToSceneCameraCommands(listener);
    useSceneCameraStore.getState().setCameraReady(false);
    useSceneCameraStore.getState().setCameraReady(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not repeat a command when other parts of the store change', () => {
    const listener = vi.fn();
    subscribeToSceneCameraCommands(listener);
    useSceneCameraStore.getState().sendCommand({ kind: 'home' });

    useSceneCameraStore.getState().setCameraReady(false);
    useSceneCameraStore.getState().setCameraReady(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops after the unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSceneCameraCommands(listener);

    unsubscribe();
    useSceneCameraStore.getState().sendCommand({ kind: 'home' });

    expect(listener).not.toHaveBeenCalled();
  });
});
