import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { QUIET_MODE_STORAGE_KEY } from './quietModeStorage';
import { useAssistantQuietModeStore } from './useAssistantQuietModeStore';

const startStoreFrom = async (rawValue: string | undefined): Promise<typeof useAssistantQuietModeStore> => {
  if (rawValue !== undefined) {
    window.localStorage.setItem(QUIET_MODE_STORAGE_KEY, rawValue);
  }

  vi.resetModules();

  const { useAssistantQuietModeStore: freshStore } = await import('./useAssistantQuietModeStore');

  return freshStore;
};

describe('useAssistantQuietModeStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAssistantQuietModeStore.setState({ isQuiet: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the switched value after the store is created again', async () => {
    useAssistantQuietModeStore.getState().setQuiet(true);

    const freshStore = await startStoreFrom(undefined);

    expect(freshStore.getState().isQuiet).toBe(true);
  });

  it('forgets the value when the mode is switched off', async () => {
    useAssistantQuietModeStore.getState().setQuiet(true);
    useAssistantQuietModeStore.getState().setQuiet(false);

    const freshStore = await startStoreFrom(undefined);

    expect(freshStore.getState().isQuiet).toBe(false);
  });

  it('starts switched off when nothing is saved', async () => {
    const freshStore = await startStoreFrom(undefined);

    expect(freshStore.getState().isQuiet).toBe(false);
  });

  it('treats a saved value that is not a flag as switched off', async () => {
    const freshStore = await startStoreFrom(JSON.stringify({ state: { isQuiet: true } }));

    expect(freshStore.getState().isQuiet).toBe(false);
  });

  it('starts switched off when the storage refuses to read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const freshStore = await startStoreFrom(undefined);

    expect(freshStore.getState().isQuiet).toBe(false);
  });

  it('keeps working when the storage refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    useAssistantQuietModeStore.getState().setQuiet(true);

    expect(useAssistantQuietModeStore.getState().isQuiet).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith('> quietModeStorage -> writeStoredQuietMode:', expect.anything());
  });
});
