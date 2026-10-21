import type { ReactElement } from 'react';
import type { Color } from 'three';

import { renderHook } from '@testing-library/react';
import { SRGBColorSpace } from 'three';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { readWorldPalette } from '../palette/readWorldPalette';
import { useWorldMaterialsContext } from './useWorldMaterialsContext';
import { WorldMaterialsProvider } from './WorldMaterialsProvider';

const invalidate = vi.hoisted(() => vi.fn());

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { invalidate: () => void }) => unknown): unknown => select({ invalidate }),
}));

const CHANNEL_MAX = 255;

const FIRST_PALETTE = readWorldPalette(() => '#0a141e');
const SECOND_PALETTE = readWorldPalette(() => '#6496c8');

const readRed = (color: Color): number => {
  const target = {
    b: 0,
    g: 0,
    r: 0,
  };
  color.getRGB(target, SRGBColorSpace);

  return Math.round(target.r * CHANNEL_MAX);
};

describe('WorldMaterialsProvider', () => {
  it('puts both registries into the context', () => {
    const { result } = renderHook(() => useWorldMaterialsContext(), {
      wrapper: ({ children }): ReactElement => <WorldMaterialsProvider palette={FIRST_PALETTE}>{children}</WorldMaterialsProvider>,
    });

    expect(result.current.registry.get('road').isMeshStandardMaterial).toBe(true);
    expect(result.current.glow.get({ key: 'road', kind: 'unlit' }).isMeshBasicMaterial).toBe(true);
    expect(result.current.glow.dayNight.value).toBe(0);
  });

  it('recolors both registries when the palette changes', () => {
    let palette = FIRST_PALETTE;
    const { rerender, result } = renderHook(() => useWorldMaterialsContext(), {
      wrapper: ({ children }): ReactElement => <WorldMaterialsProvider palette={palette}>{children}</WorldMaterialsProvider>,
    });
    const lit = result.current.registry.get('road');
    const glowing = result.current.glow.get({ key: 'road', kind: 'unlit' });

    expect(readRed(lit.color)).toBe(10);
    expect(readRed(glowing.color)).toBe(10);

    palette = SECOND_PALETTE;
    rerender();

    expect(readRed(lit.color)).toBe(100);
    expect(readRed(glowing.color)).toBe(100);
    expect(invalidate).toHaveBeenCalled();
  });

  it('disposes both registries on unmount', () => {
    const { result, unmount } = renderHook(() => useWorldMaterialsContext(), {
      wrapper: ({ children }): ReactElement => <WorldMaterialsProvider palette={FIRST_PALETTE}>{children}</WorldMaterialsProvider>,
    });
    const litDispose = vi.spyOn(result.current.registry.get('road'), 'dispose');
    const glowDispose = vi.spyOn(result.current.glow.get({ key: 'road', kind: 'unlit' }), 'dispose');

    unmount();

    expect(litDispose).toHaveBeenCalledTimes(1);
    expect(glowDispose).toHaveBeenCalledTimes(1);
  });
});
