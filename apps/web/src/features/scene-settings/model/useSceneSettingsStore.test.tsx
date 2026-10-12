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

const rehydrateFrom = async (rawValue: string): Promise<void> => {
  window.localStorage.setItem(GRAPHICS_STORAGE_KEY, rawValue);
  await useSceneSettingsStore.persist.rehydrate();
};

describe('useSceneSettingsStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSceneSettingsStore.setState({ autoLevel: undefined, isSceneUnavailable: false, preference: undefined });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves only the preference, never the measured level', () => {
    useSceneSettingsStore.getState().reportAutoLevel('low');
    useSceneSettingsStore.getState().setPreference('medium');

    expect(readStoredState()).toEqual({ preference: 'medium' });
    expect(useSceneSettingsStore.getState().autoLevel).toBe('low');
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

  it('restores a saved preference', async () => {
    await rehydrateFrom(JSON.stringify({ state: { preference: 'off' }, version: 0 }));

    expect(useSceneSettingsStore.getState().preference).toBe('off');
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['an unknown level', JSON.stringify({ state: { preference: 'ultra' }, version: 0 })],
    ['a number', JSON.stringify({ state: { preference: 3 }, version: 0 })],
    ['a missing state', JSON.stringify({ version: 0 })],
    ['a null state', JSON.stringify({ state: null, version: 0 })],
    ['a bare string', JSON.stringify('high')],
  ])('treats %s as the device default', async (_title, rawValue) => {
    await rehydrateFrom(rawValue);

    expect(useSceneSettingsStore.getState().preference).toBeUndefined();
  });

  it('keeps working when the storage refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    useSceneSettingsStore.getState().setPreference('low');

    expect(useSceneSettingsStore.getState().preference).toBe('low');
  });
});
