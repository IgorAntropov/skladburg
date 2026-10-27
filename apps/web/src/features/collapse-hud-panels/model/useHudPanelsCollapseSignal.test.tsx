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
} from 'vitest';

import { requestHudMapView } from './requestHudMapView';
import { resetHudPanelsStore } from './resetHudPanelsStore';
import { useHudPanelsCollapseSignal } from './useHudPanelsCollapseSignal';
import { useHudPanelsStore } from './useHudPanelsStore';

const StrictWrapper = ({ children }: { children: ReactNode }): ReactNode => <StrictMode>{children}</StrictMode>;

const toggleCollapsed = (): void => {
  act(() => {
    useHudPanelsStore.getState().toggleCollapsed();
  });
};

const requestMapView = (): void => {
  act(() => {
    useHudPanelsStore.getState().registerCollapsible();
    requestHudMapView(0);
  });
};

describe('useHudPanelsCollapseSignal', () => {
  beforeEach(() => {
    resetHudPanelsStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('changes when the mode is turned on by the button and not when it is turned off', () => {
    const { result } = renderHook(() => useHudPanelsCollapseSignal(true));
    const initial = result.current;

    toggleCollapsed();

    const afterOn = result.current;

    expect(afterOn).not.toBe(initial);

    toggleCollapsed();

    expect(result.current).toBe(afterOn);
  });

  it('changes on every map view request, also while the panels are already collapsed', () => {
    const { result } = renderHook(() => useHudPanelsCollapseSignal(true));

    requestMapView();

    const afterFirst = result.current;

    requestMapView();

    expect(result.current).not.toBe(afterFirst);
  });

  it('changes when the layout starts to allow collapsing while the mode is already on', () => {
    toggleCollapsed();

    const { rerender, result } = renderHook(({ canCollapse }) => useHudPanelsCollapseSignal(canCollapse), {
      initialProps: { canCollapse: false },
    });
    const whileForbidden = result.current;

    rerender({ canCollapse: true });

    expect(result.current).not.toBe(whileForbidden);
  });

  it('keeps the value while the layout cannot collapse and after it can again with the mode off', () => {
    const { rerender, result } = renderHook(
      ({ canCollapse }: { canCollapse: boolean }) => useHudPanelsCollapseSignal(canCollapse),
      { initialProps: { canCollapse: false } },
    );
    const initial = result.current;

    toggleCollapsed();
    requestMapView();
    toggleCollapsed();

    expect(result.current).toBe(initial);

    rerender({ canCollapse: true });

    expect(result.current).toBe(initial);
  });

  it('does not change for a layout that mounts when the mode is already on', () => {
    toggleCollapsed();

    const { rerender, result } = renderHook(() => useHudPanelsCollapseSignal(true));
    const initial = result.current;

    rerender();

    expect(result.current).toBe(initial);
  });

  it('changes by one step for one request under strict mode', () => {
    const { result } = renderHook(() => useHudPanelsCollapseSignal(true), { wrapper: StrictWrapper });
    const initial = result.current;

    toggleCollapsed();

    expect(result.current).toBe(initial + 1);
  });
});
