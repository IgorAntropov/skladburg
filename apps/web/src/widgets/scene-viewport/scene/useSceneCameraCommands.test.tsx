import { renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IIsometricCameraRig } from '@/shared/3d';

import type {
  SceneCameraCommandListener,
  SceneCameraCommandSubscription,
} from '../model/subscribeToSceneCameraCommands';

import {
  runSceneCameraCommand,
  useSceneCameraCommands,
} from './useSceneCameraCommands';

interface FakeSubscriptionValue {
  readonly emit: ReturnType<typeof vi.fn<SceneCameraCommandListener>>;
  readonly subscribe: SceneCameraCommandSubscription;
  readonly unsubscribe: ReturnType<typeof vi.fn>;
}

const createRig = (): IIsometricCameraRig => ({
  flyTo: vi.fn(),
  follow: vi.fn(),
  home: vi.fn(),
  rotate: vi.fn(),
  zoom: vi.fn(),
});

const createFakeSubscription = (): FakeSubscriptionValue => {
  const unsubscribe = vi.fn();
  const emit = vi.fn<SceneCameraCommandListener>();
  const subscribe: SceneCameraCommandSubscription = (listener) => {
    emit.mockImplementation(listener);

    return unsubscribe;
  };

  return { emit, subscribe, unsubscribe };
};

describe('runSceneCameraCommand', () => {
  it('maps every command to its rig method', () => {
    const rig = createRig();

    runSceneCameraCommand(rig, { kind: 'home' });
    runSceneCameraCommand(rig, { direction: -1, kind: 'rotate' });
    runSceneCameraCommand(rig, { direction: 1, kind: 'zoom' });

    expect(rig.home).toHaveBeenCalledTimes(1);
    expect(rig.rotate).toHaveBeenCalledExactlyOnceWith(-1);
    expect(rig.zoom).toHaveBeenCalledExactlyOnceWith(1);
  });
});

describe('useSceneCameraCommands', () => {
  it('runs the commands it receives on the rig', () => {
    const rig = createRig();
    const { emit, subscribe } = createFakeSubscription();
    renderHook(() => {
      useSceneCameraCommands({ current: rig }, subscribe);
    });

    emit({ direction: 1, kind: 'rotate' });
    emit({ direction: 1, kind: 'rotate' });
    emit({ kind: 'home' });

    expect(vi.mocked(rig.rotate)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(rig.home)).toHaveBeenCalledTimes(1);
  });

  it('skips a command while the rig is not mounted', () => {
    const { emit, subscribe } = createFakeSubscription();
    renderHook(() => {
      useSceneCameraCommands({ current: null }, subscribe);
    });

    expect(() => {
      emit({ kind: 'home' });
    }).not.toThrow();
  });

  it('subscribes once and unsubscribes on unmount', () => {
    const rig = createRig();
    const { subscribe, unsubscribe } = createFakeSubscription();
    const subscribeSpy = vi.fn(subscribe);
    const rigRef = { current: rig };
    const mounted = renderHook(() => {
      useSceneCameraCommands(rigRef, subscribeSpy);
    });

    mounted.rerender();

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();

    mounted.unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
