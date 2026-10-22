import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import { StrictMode } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { resetHudPanelsStore } from './resetHudPanelsStore';
import { useCollapsibleHudPanels } from './useCollapsibleHudPanels';
import { useHudPanelsStore } from './useHudPanelsStore';
import { useIsHudPanelsToggleAvailable } from './useIsHudPanelsToggleAvailable';

const StrictWrapper = ({ children }: { children: ReactNode }): ReactNode => <StrictMode>{children}</StrictMode>;

const setScrollY = (value: number): void => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value });
};

describe('useCollapsibleHudPanels', () => {
  beforeEach(() => {
    resetHudPanelsStore();
  });

  afterEach(() => {
    cleanup();
    setScrollY(0);
    vi.restoreAllMocks();
  });

  it('leaves exactly one registration in the double effect of StrictMode and none after unmount', () => {
    const { unmount } = renderHook(() => useCollapsibleHudPanels(true), { wrapper: StrictWrapper });

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(1);

    unmount();

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(0);
  });

  it('registers only while the layout allows collapsing', () => {
    const { rerender } = renderHook(({ canCollapse }) => useCollapsibleHudPanels(canCollapse), {
      initialProps: { canCollapse: false },
    });

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(0);

    rerender({ canCollapse: true });

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(1);

    rerender({ canCollapse: false });

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(0);
  });

  it('makes the toggle available only while a layout is registered', () => {
    const toggle = renderHook(() => useIsHudPanelsToggleAvailable());

    expect(toggle.result.current).toBe(false);

    const layout = renderHook(() => useCollapsibleHudPanels(true));

    expect(toggle.result.current).toBe(true);

    layout.unmount();

    expect(toggle.result.current).toBe(false);
  });

  it('reports the collapsed state only for a layout that can collapse', () => {
    const collapsible = renderHook(() => useCollapsibleHudPanels(true));
    const fixed = renderHook(() => useCollapsibleHudPanels(false));

    act(() => {
      useHudPanelsStore.getState().toggleCollapsed();
    });

    expect(collapsible.result.current).toBe(true);
    expect(fixed.result.current).toBe(false);
  });

  it('keeps the collapsed state while the layout leaves and comes back', () => {
    const first = renderHook(() => useCollapsibleHudPanels(true));

    act(() => {
      useHudPanelsStore.getState().toggleCollapsed();
    });
    first.unmount();

    const second = renderHook(() => useCollapsibleHudPanels(true));

    expect(second.result.current).toBe(true);
  });

  it('brings the page scroll position back when the panels return', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    renderHook(() => useCollapsibleHudPanels(true));
    setScrollY(240);

    act(() => {
      useHudPanelsStore.getState().toggleCollapsed();
    });

    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      useHudPanelsStore.getState().toggleCollapsed();
    });

    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });
});
