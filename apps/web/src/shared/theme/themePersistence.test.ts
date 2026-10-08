import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createFakeStorage } from './testing/themeFakes';
import {
  getDeviceStorage,
  parseThemePreference,
  THEME_STORAGE_KEY,
  writeStoredThemePreference,
} from './themePersistence';

describe('themePersistence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['dark', 'light', 'system'])('accepts the preference %s', (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  it.each([null, undefined, '', 'Dark', 1, {}])('rejects the value %j', (value) => {
    expect(parseThemePreference(value)).toBeUndefined();
  });

  it('returns the storage of the device', () => {
    const storage = createFakeStorage();

    expect(getDeviceStorage({ localStorage: storage })).toBe(storage);
  });

  it('returns nothing and reports it when access to the storage is denied', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = {
      get localStorage(): Storage {
        throw new DOMException('access denied', 'SecurityError');
      },
    };

    expect(getDeviceStorage(target)).toBeUndefined();
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toBe('> themePersistence -> getDeviceStorage:');
  });

  it('writes the preference under the shared key', () => {
    const storage = createFakeStorage();

    writeStoredThemePreference(storage, 'system');

    expect(storage.values.get(THEME_STORAGE_KEY)).toBe('system');
    expect(THEME_STORAGE_KEY).toBe('theme-preference');
  });

  it('does nothing when there is no storage', () => {
    expect(() => {
      writeStoredThemePreference(undefined, 'dark');
    }).not.toThrow();
  });
});
