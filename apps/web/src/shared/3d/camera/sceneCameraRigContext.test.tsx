import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IIsometricCameraRig } from './cameraTypes';

import {
  SceneCameraRigProvider,
  useSceneCameraRig,
} from './sceneCameraRigContext';

const createRig = (): IIsometricCameraRig => ({
  flyTo: vi.fn(),
  follow: vi.fn(),
  home: vi.fn(),
  rotate: vi.fn(),
  zoom: vi.fn(),
});

describe('useSceneCameraRig', () => {
  it('gives the same ref the provider received', () => {
    const rigRef = { current: createRig() };
    const { result } = renderHook(() => useSceneCameraRig(), {
      wrapper: ({ children }): ReactElement => <SceneCameraRigProvider rigRef={rigRef}>{children}</SceneCameraRigProvider>,
    });

    expect(result.current).toBe(rigRef);
  });

  it('reads the rig that appears in the ref after the first render', () => {
    const rigRef: { current: IIsometricCameraRig | null } = { current: null };
    const { result } = renderHook(() => useSceneCameraRig(), {
      wrapper: ({ children }): ReactElement => <SceneCameraRigProvider rigRef={rigRef}>{children}</SceneCameraRigProvider>,
    });
    const rig = createRig();

    expect(result.current.current).toBeNull();

    rigRef.current = rig;

    expect(result.current.current).toBe(rig);
  });

  it('throws outside of the provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useSceneCameraRig())).toThrow('only inside SceneCameraRigProvider');

    errorSpy.mockRestore();
  });
});
