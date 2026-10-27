import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { GRAPHICS_STORAGE_KEY } from './graphicsPreference';
import { useSceneSettingsStore } from './useSceneSettingsStore';

const readStoredState = (): unknown => {
  const rawValue = window.localStorage.getItem(GRAPHICS_STORAGE_KEY);

  return rawValue === null ? undefined : (JSON.parse(rawValue) as { state: unknown }).state;
};

const startStoreFrom = async (rawValue: string | undefined): Promise<typeof useSceneSettingsStore> => {
  if (rawValue !== undefined) {
    window.localStorage.setItem(GRAPHICS_STORAGE_KEY, rawValue);
  }

  vi.resetModules();

  const { useSceneSettingsStore: freshStore } = await import('./useSceneSettingsStore');

  return freshStore;
};

describe('useSceneSettingsStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSceneSettingsStore.setState({
      autoLevel: undefined,
      autoLevelChangeCount: 0,
      isSceneUnavailable: false,
      preference: undefined,
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves only the preference, never the measured level or the change count', () => {
    useSceneSettingsStore.getState().reportAutoLevel('low', 'measured');
    useSceneSettingsStore.getState().setPreference('medium');

    expect(readStoredState()).toEqual({ preference: 'medium' });
    expect(useSceneSettingsStore.getState().autoLevel).toBe('low');
    expect(window.localStorage.getItem(GRAPHICS_STORAGE_KEY)).not.toContain('autoLevelChangeCount');
  });

  it('starts without a known level and without level changes', () => {
    expect(useSceneSettingsStore.getState().autoLevel).toBeUndefined();
    expect(useSceneSettingsStore.getState().autoLevelChangeCount).toBe(0);
  });

  it('counts a measured level and not the starting one', () => {
    useSceneSettingsStore.getState().reportAutoLevel('high', 'start');

    expect(useSceneSettingsStore.getState().autoLevel).toBe('high');
    expect(useSceneSettingsStore.getState().autoLevelChangeCount).toBe(0);

    useSceneSettingsStore.getState().reportAutoLevel('medium', 'measured');
    useSceneSettingsStore.getState().reportAutoLevel('low', 'measured');

    expect(useSceneSettingsStore.getState().autoLevel).toBe('low');
    expect(useSceneSettingsStore.getState().autoLevelChangeCount).toBe(2);
  });

  it('remembers that the scene is unavailable until the preference is chosen again', () => {
    useSceneSettingsStore.getState().markSceneUnavailable();

    expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(true);

    useSceneSettingsStore.getState().setPreference('auto');

    expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(false);
  });

  it('resets the memory even when the same preference is chosen again', () => {
    useSceneSettingsStore.getState().setPreference('auto');
    useSceneSettingsStore.getState().markSceneUnavailable();
    useSceneSettingsStore.getState().setPreference('auto');

    expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(false);
    expect(useSceneSettingsStore.getState().preference).toBe('auto');
  });

  it('keeps the unavailable memory out of the storage', () => {
    useSceneSettingsStore.getState().setPreference('high');
    useSceneSettingsStore.getState().markSceneUnavailable();

    expect(readStoredState()).toEqual({ preference: 'high' });
    expect(window.localStorage.getItem(GRAPHICS_STORAGE_KEY)).not.toContain('isSceneUnavailable');
  });

  it('restores a preference saved in the earlier format', async () => {
    const freshStore = await startStoreFrom(JSON.stringify({ state: { preference: 'off' }, version: 0 }));

    expect(freshStore.getState().preference).toBe('off');
  });

  it('writes the preference in the same format it reads', async () => {
    useSceneSettingsStore.getState().setPreference('medium');

    expect(window.localStorage.getItem(GRAPHICS_STORAGE_KEY)).toBe(JSON.stringify({ state: { preference: 'medium' }, version: 0 }));

    const freshStore = await startStoreFrom(undefined);

    expect(freshStore.getState().preference).toBe('medium');
  });

  it('starts without a preference when nothing is saved', async () => {
    const freshStore = await startStoreFrom(undefined);

    expect(freshStore.getState().preference).toBeUndefined();
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['an unknown level', JSON.stringify({ state: { preference: 'ultra' }, version: 0 })],
    ['a number', JSON.stringify({ state: { preference: 3 }, version: 0 })],
    ['a missing state', JSON.stringify({ version: 0 })],
    ['a null state', JSON.stringify({ state: null, version: 0 })],
    ['a bare string', JSON.stringify('high')],
  ])('treats %s as the device default', async (_title, rawValue) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const freshStore = await startStoreFrom(rawValue);

    expect(freshStore.getState().preference).toBeUndefined();
  });

  it('starts with the device default when the storage refuses to read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const freshStore = await startStoreFrom(undefined);

    expect(freshStore.getState().preference).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('> graphicsPreferenceStorage -> readStoredPreference:', expect.anything());
  });

  it('keeps working when the storage refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    useSceneSettingsStore.getState().setPreference('low');

    expect(useSceneSettingsStore.getState().preference).toBe('low');
    expect(errorSpy).toHaveBeenCalledWith('> graphicsPreferenceStorage -> writeStoredPreference:', expect.anything());
  });
});
