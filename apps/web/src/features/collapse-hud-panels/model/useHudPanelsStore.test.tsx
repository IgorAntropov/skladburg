import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { requestHudMapView } from './requestHudMapView';
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

  it('raises the collapse signal when the button collapses and keeps it when the button expands', () => {
    useHudPanelsStore.getState().toggleCollapsed();

    expect(useHudPanelsStore.getState().collapseSignal).toBe(1);

    useHudPanelsStore.getState().toggleCollapsed();

    expect(useHudPanelsStore.getState().isCollapsed).toBe(false);
    expect(useHudPanelsStore.getState().collapseSignal).toBe(1);
  });

  describe('requestHudMapView', () => {
    it('changes nothing while no layout is registered', () => {
      requestHudMapView(240);

      expect(useHudPanelsStore.getState().isCollapsed).toBe(false);
      expect(useHudPanelsStore.getState().savedScrollY).toBe(0);
      expect(useHudPanelsStore.getState().collapseSignal).toBe(0);
    });

    it('collapses the panels, remembers the scroll position and raises the signal', () => {
      useHudPanelsStore.getState().registerCollapsible();

      requestHudMapView(240);

      expect(useHudPanelsStore.getState().isCollapsed).toBe(true);
      expect(useHudPanelsStore.getState().savedScrollY).toBe(240);
      expect(useHudPanelsStore.getState().collapseSignal).toBe(1);
    });

    it('raises the signal again and keeps the saved scroll position while the panels are already collapsed', () => {
      useHudPanelsStore.getState().registerCollapsible();
      requestHudMapView(240);

      requestHudMapView(0);

      expect(useHudPanelsStore.getState().isCollapsed).toBe(true);
      expect(useHudPanelsStore.getState().savedScrollY).toBe(240);
      expect(useHudPanelsStore.getState().collapseSignal).toBe(2);
    });

    it('collapses again with the new scroll position after the panels were shown', () => {
      useHudPanelsStore.getState().registerCollapsible();
      requestHudMapView(240);
      useHudPanelsStore.getState().toggleCollapsed();

      requestHudMapView(80);

      expect(useHudPanelsStore.getState().isCollapsed).toBe(true);
      expect(useHudPanelsStore.getState().savedScrollY).toBe(80);
      expect(useHudPanelsStore.getState().collapseSignal).toBe(2);
    });
  });
});
