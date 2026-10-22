import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { resetHudPanelsStore } from './resetHudPanelsStore';
import { useHudPanelsStore } from './useHudPanelsStore';

describe('useHudPanelsStore', () => {
  beforeEach(() => {
    resetHudPanelsStore();
  });

  it('counts every registration and drops it once on release', () => {
    const { registerCollapsible } = useHudPanelsStore.getState();

    const releaseFirst = registerCollapsible();
    const releaseSecond = registerCollapsible();

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(2);

    releaseFirst();
    releaseFirst();

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(1);

    releaseSecond();

    expect(useHudPanelsStore.getState().collapsibleCount).toBe(0);
  });

  it('remembers the page scroll position at the moment of collapsing', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 });

    useHudPanelsStore.getState().toggleCollapsed();

    expect(useHudPanelsStore.getState().savedScrollY).toBe(320);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });
});
