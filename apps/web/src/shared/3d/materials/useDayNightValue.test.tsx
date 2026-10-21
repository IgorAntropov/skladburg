import type {
  ReactElement,
  ReactNode,
} from 'react';

import { renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { WorldMaterialsContextValue } from './WorldMaterialsContext';

import { readWorldPalette } from '../palette/readWorldPalette';
import { createWorldGlowMaterialRegistry } from './createWorldGlowMaterialRegistry';
import { createWorldMaterialRegistry } from './createWorldMaterialRegistry';
import { useDayNightValue } from './useDayNightValue';
import { useWorldGlowMaterial } from './useWorldGlowMaterial';
import { WorldMaterialsContext } from './WorldMaterialsContext';

const PALETTE = readWorldPalette(() => '#808080');

const createContextValue = (): WorldMaterialsContextValue => ({
  glow: createWorldGlowMaterialRegistry(PALETTE),
  palette: PALETTE,
  registry: createWorldMaterialRegistry(PALETTE),
});

const createWrapper = (value: WorldMaterialsContextValue): (({ children }: { children: ReactNode }) => ReactElement) => {
  return ({ children }): ReactElement => <WorldMaterialsContext value={value}>{children}</WorldMaterialsContext>;
};

describe('useDayNightValue', () => {
  it('gives the value object of the glow registry', () => {
    const value = createContextValue();
    const { result } = renderHook(() => useDayNightValue(), { wrapper: createWrapper(value) });

    expect(result.current).toBe(value.glow.dayNight);
  });

  it('reads the value written after the first render without rendering again', () => {
    const value = createContextValue();
    const { result } = renderHook(() => useDayNightValue(), { wrapper: createWrapper(value) });
    const { current } = result;

    value.glow.applyDayNight(0.6);

    expect(result.current).toBe(current);
    expect(result.current.value).toBe(0.6);
  });

  it('throws outside of the provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useDayNightValue())).toThrow('only inside WorldMaterialsProvider');

    errorSpy.mockRestore();
  });
});

describe('useWorldGlowMaterial', () => {
  it('gives the registry material for the specification', () => {
    const value = createContextValue();
    const { result } = renderHook(() => useWorldGlowMaterial({ key: 'road', kind: 'unlit' }), {
      wrapper: createWrapper(value),
    });

    expect(result.current).toBe(value.glow.get({ key: 'road', kind: 'unlit' }));
  });

  it('gives the same material for an equal specification across renders', () => {
    const value = createContextValue();
    const { rerender, result } = renderHook(
      () => useWorldGlowMaterial({ key: 'road', kind: 'nightAdditive', strength: 0.5 }),
      { wrapper: createWrapper(value) },
    );
    const { current } = result;

    rerender();

    expect(result.current).toBe(current);
  });

  it('throws outside of the provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useWorldGlowMaterial({ key: 'road', kind: 'unlit' }))).toThrow(
      'only inside WorldMaterialsProvider',
    );

    errorSpy.mockRestore();
  });
});
