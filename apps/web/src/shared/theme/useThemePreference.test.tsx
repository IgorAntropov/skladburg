import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IThemePreferenceStore } from './themeTypes';

import { createThemePreferenceStore } from './createThemePreferenceStore';
import { ThemePreferenceProvider } from './ThemePreferenceProvider';
import { useThemePreference } from './useThemePreference';

const createStore = (): IThemePreferenceStore => createThemePreferenceStore({
  colorSchemeQuery: undefined,
  storage: undefined,
  storageEvents: undefined,
});

const ThemeProbe = (): ReactElement => {
  const { preference, resolvedTheme, setPreference } = useThemePreference();

  const handleDarkClick = (): void => {
    setPreference('dark');
  };

  return (
    <button onClick={handleDarkClick} type="button">
      {`${preference}:${resolvedTheme}`}
    </button>
  );
};

describe('useThemePreference', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('returns the preference and the resolved theme of the store inside the provider', () => {
    const store = createStore();
    store.setPreference('dark');

    const { result } = renderHook(() => useThemePreference(), {
      wrapper: ({ children }) => <ThemePreferenceProvider store={store}>{children}</ThemePreferenceProvider>,
    });

    expect(result.current.preference).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('rerenders the consumers when the preference is set through the hook', () => {
    render(<ThemePreferenceProvider store={createStore()}><ThemeProbe /></ThemePreferenceProvider>);

    expect(screen.getByRole('button').textContent).toBe('light:light');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button').textContent).toBe('dark:dark');
  });

  it('rerenders the consumers when the store changes from outside', () => {
    const store = createStore();
    render(<ThemePreferenceProvider store={store}><ThemeProbe /></ThemePreferenceProvider>);

    act(() => {
      store.setPreference('system');
    });

    expect(screen.getByRole('button').textContent).toBe('system:light');
  });

  it('keeps the setter and the value of the handle stable between unrelated renders', () => {
    const store = createStore();
    const { rerender, result } = renderHook(() => useThemePreference(), {
      wrapper: ({ children }) => <ThemePreferenceProvider store={store}>{children}</ThemePreferenceProvider>,
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('fails with a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useThemePreference())).toThrow('useThemePreference must be used inside ThemePreferenceProvider');
  });
});
