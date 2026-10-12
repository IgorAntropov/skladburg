import { runInNewContext } from 'node:vm';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  DARK_COLOR_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
} from '../src/shared/theme/themeConstants.ts';
import { createThemeBootScript } from './createThemeBootScript.ts';

interface FakeRootValue {
  dataset: Record<string, string | undefined>;
  style: { colorScheme: string | undefined };
}

interface RunOptionsValue {
  hasMatchMedia?: boolean;
  isDarkSystem?: boolean;
  isMatchMediaBroken?: boolean;
  isStorageBroken?: boolean;
  stored?: null | string;
}

const script = createThemeBootScript({
  darkQuery: DARK_COLOR_SCHEME_QUERY,
  defaultPreference: DEFAULT_THEME_PREFERENCE,
  storageKey: THEME_STORAGE_KEY,
});

const runScript = (options: RunOptionsValue = {}): { queries: string[]; root: FakeRootValue; storageKeys: string[] } => {
  const { hasMatchMedia = true, isDarkSystem = false, isMatchMediaBroken = false, isStorageBroken = false, stored = null } = options;
  const root: FakeRootValue = { dataset: {}, style: { colorScheme: undefined } };
  const queries: string[] = [];
  const storageKeys: string[] = [];
  const sandbox: Record<string, unknown> = { document: { documentElement: root } };

  if (isStorageBroken) {
    Object.defineProperty(sandbox, 'localStorage', {
      get: () => {
        throw new Error('storage is blocked');
      },
    });
  }
  else {
    sandbox.localStorage = {
      getItem: (key: string): null | string => {
        storageKeys.push(key);

        return stored;
      },
    };
  }

  if (hasMatchMedia) {
    sandbox.matchMedia = (query: string): { matches: boolean } => {
      queries.push(query);

      if (isMatchMediaBroken) {
        throw new Error('matchMedia is broken');
      }

      return { matches: isDarkSystem };
    };
  }

  runInNewContext(script, sandbox);

  return { queries, root, storageKeys };
};

describe('createThemeBootScript', () => {
  it('puts the stored light theme on the root element', () => {
    const { root } = runScript({ stored: 'light' });

    expect(root.dataset.theme).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });

  it('puts the stored dark theme on the root element', () => {
    const { root } = runScript({ stored: 'dark' });

    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('does not consult the color scheme of the device for an explicit theme', () => {
    const { queries } = runScript({ isDarkSystem: true, stored: 'light' });

    expect(queries).toEqual([]);
  });

  it.each([
    { expected: 'dark', isDarkSystem: true },
    { expected: 'light', isDarkSystem: false },
  ])('resolves the system preference to $expected when the device is dark: $isDarkSystem', ({ expected, isDarkSystem }) => {
    const { queries, root } = runScript({ isDarkSystem, stored: 'system' });

    expect(root.dataset.theme).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
    expect(queries).toEqual([DARK_COLOR_SCHEME_QUERY]);
  });

  it('reads the key under which the theme store saves the preference', () => {
    const { storageKeys } = runScript({ stored: 'dark' });

    expect(storageKeys).toEqual([THEME_STORAGE_KEY]);
  });

  it.each(['', 'Dark', 'blue', '1', '{"theme":"dark"}'])('falls back to the default theme for the stored value %j', (stored) => {
    const { root } = runScript({ isDarkSystem: true, stored });

    expect(root.dataset.theme).toBe(DEFAULT_THEME_PREFERENCE);
    expect(root.style.colorScheme).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('falls back to the default theme when nothing is stored', () => {
    const { root } = runScript({ stored: null });

    expect(root.dataset.theme).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('falls back to the default theme without throwing when the storage is blocked', () => {
    const { root } = runScript({ isStorageBroken: true });

    expect(root.dataset.theme).toBe(DEFAULT_THEME_PREFERENCE);
    expect(root.style.colorScheme).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('resolves the system preference to light when matchMedia is missing', () => {
    const { root } = runScript({ hasMatchMedia: false, stored: 'system' });

    expect(root.dataset.theme).toBe('light');
  });

  it('resolves the system preference to light without throwing when matchMedia fails', () => {
    const { root } = runScript({ isMatchMediaBroken: true, stored: 'system' });

    expect(root.dataset.theme).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });

  it('applies a system default when the default preference is system', () => {
    const systemScript = createThemeBootScript({
      darkQuery: DARK_COLOR_SCHEME_QUERY,
      defaultPreference: 'system',
      storageKey: THEME_STORAGE_KEY,
    });
    const root: FakeRootValue = { dataset: {}, style: { colorScheme: undefined } };

    runInNewContext(systemScript, {
      document: { documentElement: root },
      localStorage: { getItem: (): null => null },
      matchMedia: (): { matches: boolean } => ({ matches: true }),
    });

    expect(root.dataset.theme).toBe('dark');
  });

  it('keeps the script free of closing script tags whatever the options are', () => {
    const hostileScript = createThemeBootScript({
      darkQuery: '</script><b>',
      defaultPreference: 'light',
      storageKey: '</script>',
    });

    expect(hostileScript).not.toContain('</script');
    expect(hostileScript).not.toContain('<');
  });
});
