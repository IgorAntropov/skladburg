import type { Mock } from 'vitest';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { useSceneCameraStore } from '../model/useSceneCameraStore';
import { SceneCameraControls } from './SceneCameraControls';

type PanelModuleValue = typeof import('./controls/SceneCameraControlsPanel');

const loaderControl = vi.hoisted(() => ({
  load: vi.fn<() => Promise<unknown>>(),
  peek: vi.fn<() => unknown>(),
}));

vi.mock('../lib/loadSceneCameraControls', () => ({
  loadSceneCameraControls: Object.assign(
    () => loaderControl.load(),
    { peekLoadedModule: () => loaderControl.peek() },
  ),
}));

const LOAD_ERROR = new Error('the camera controls chunk is unavailable');

const loadActualPanel = (): Promise<PanelModuleValue> => import('./controls/SceneCameraControlsPanel');

const setCameraReady = (isReady: boolean): void => {
  act(() => {
    useSceneCameraStore.getState().setCameraReady(isReady);
  });
};

const renderControls = (): void => {
  render(withTestLocalizer(<SceneCameraControls />));
};

describe('SceneCameraControls', () => {
  let logSpy: Mock<typeof console.log>;

  beforeEach(() => {
    useSceneCameraStore.setState({ command: undefined, isCameraReady: false });
    loaderControl.load.mockReset();
    loaderControl.peek.mockReset();
    loaderControl.peek.mockReturnValue(undefined);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing and does not request the chunk while the camera is not ready', () => {
    loaderControl.load.mockImplementation(loadActualPanel);

    renderControls();

    expect(screen.queryByTestId('scene-camera-home')).toBeNull();
    expect(loaderControl.load).not.toHaveBeenCalled();
  });

  it('shows the buttons after the chunk is loaded once the camera is ready', async () => {
    loaderControl.load.mockImplementation(loadActualPanel);
    renderControls();

    setCameraReady(true);

    expect(await screen.findByTestId('scene-camera-home')).toBeTruthy();
    expect(screen.getByTestId('scene-camera-rotate-left')).toBeTruthy();
    expect(screen.getByTestId('scene-camera-rotate-right')).toBeTruthy();
    expect(screen.getByTestId('scene-camera-zoom-in')).toBeTruthy();
    expect(screen.getByTestId('scene-camera-zoom-out')).toBeTruthy();
  });

  it('shows the buttons at once when the chunk is already loaded', async () => {
    loaderControl.peek.mockReturnValue(await loadActualPanel());
    useSceneCameraStore.setState({ isCameraReady: true });

    renderControls();

    expect(screen.getByTestId('scene-camera-home')).toBeTruthy();
    expect(loaderControl.load).not.toHaveBeenCalled();
  });

  it('shows no buttons and logs the error when the chunk fails to load', async () => {
    loaderControl.load.mockRejectedValue(LOAD_ERROR);
    renderControls();

    setCameraReady(true);

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith('> SceneCameraControls -> load:', { error: LOAD_ERROR });
    });
    expect(screen.queryByTestId('scene-camera-home')).toBeNull();
  });

  it('keeps the hotkeys working while the chunk is not available', async () => {
    loaderControl.load.mockRejectedValue(LOAD_ERROR);
    renderControls();
    setCameraReady(true);
    await waitFor(() => {
      expect(loaderControl.load).toHaveBeenCalledOnce();
    });

    fireEvent.keyDown(document, { code: 'Home' });

    expect(useSceneCameraStore.getState().command?.value).toEqual({ kind: 'home' });
  });

  it('loads the chunk again at the next moment the camera becomes ready', async () => {
    loaderControl.load.mockRejectedValueOnce(LOAD_ERROR).mockImplementation(loadActualPanel);
    renderControls();
    setCameraReady(true);
    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith('> SceneCameraControls -> load:', { error: LOAD_ERROR });
    });

    setCameraReady(false);
    setCameraReady(true);

    expect(await screen.findByTestId('scene-camera-home')).toBeTruthy();
    expect(loaderControl.load).toHaveBeenCalledTimes(2);
  });

  it('removes the buttons and the hotkeys when the camera stops being ready', async () => {
    loaderControl.load.mockImplementation(loadActualPanel);
    useSceneCameraStore.setState({ isCameraReady: true });
    renderControls();
    await screen.findByTestId('scene-camera-home');

    setCameraReady(false);
    fireEvent.keyDown(document, { code: 'Home' });

    expect(screen.queryByTestId('scene-camera-home')).toBeNull();
    expect(useSceneCameraStore.getState().command).toBeUndefined();
  });
});
