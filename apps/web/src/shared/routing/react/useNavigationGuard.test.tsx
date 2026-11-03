import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IMemoryLocation } from '../location/testing/createMemoryLocation';
import type {
  NavigationGuardValue,
  ShouldGuardValue,
} from './useNavigationGuard';

import { getAddressSection } from '../address/addressSections';
import { createMemoryLocation } from '../location/testing/createMemoryLocation';
import { RoutingProvider } from './RoutingProvider';
import { useNavigationGuard } from './useNavigationGuard';

interface SetupValue {
  location: IMemoryLocation;
  rerender: (props: { isDirty: boolean }) => void;
  result: { current: NavigationGuardValue };
  unmount: () => void;
}

const setup = (isDirty: boolean): SetupValue => {
  const location = createMemoryLocation('/catalog');
  const { rerender, result, unmount } = renderHook(
    ({ isDirty: current }: { isDirty: boolean }) => useNavigationGuard(current),
    {
      initialProps: { isDirty },
      wrapper: ({ children }: { children: ReactNode }) => <RoutingProvider location={location}>{children}</RoutingProvider>,
    },
  );

  return { location, rerender, result, unmount };
};

const LISTING_PATH = '/listings/b0000001-0000-4000-8000-000000000001';

const isOutsideCatalog: ShouldGuardValue = next => next === undefined || getAddressSection(next) !== 'catalog';

interface PairSetupValue {
  location: IMemoryLocation;
  result: { current: { first: NavigationGuardValue; second: NavigationGuardValue } };
}

const setupPair = (isFirstDirty: boolean, isSecondDirty: boolean): PairSetupValue => {
  const location = createMemoryLocation('/catalog');
  const { result } = renderHook(
    () => ({
      first: useNavigationGuard(isFirstDirty),
      second: useNavigationGuard(isSecondDirty, isOutsideCatalog),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => <RoutingProvider location={location}>{children}</RoutingProvider>,
    },
  );

  return { location, result };
};

const dispatchBeforeUnload = (): boolean => {
  const event = new Event('beforeunload', { cancelable: true });

  window.dispatchEvent(event);

  return event.defaultPrevented;
};

describe('useNavigationGuard', () => {
  afterEach(() => {
    cleanup();
  });

  describe('without unsaved changes', () => {
    it('lets every navigation pass and asks nothing', () => {
      const { location, result } = setup(false);

      act(() => {
        location.navigate('/deals');
      });

      expect(location.read().path).toBe('/deals');
      expect(result.current.isLeavePending).toBe(false);
    });

    it('runs the action of requestLeave at once', () => {
      const { result } = setup(false);
      const action = vi.fn();

      act(() => {
        result.current.requestLeave(action);
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(result.current.isLeavePending).toBe(false);
    });

    it('does not hold the unload of the page', () => {
      setup(false);

      expect(dispatchBeforeUnload()).toBe(false);
    });
  });

  describe('with unsaved changes', () => {
    it('holds a navigation and waits for the answer', () => {
      const { location, result } = setup(true);

      act(() => {
        location.navigate('/deals');
      });

      expect(location.read().path).toBe('/catalog');
      expect(result.current.isLeavePending).toBe(true);
    });

    it('lets a change of the query only pass', () => {
      const { location, result } = setup(true);

      act(() => {
        location.navigate('/catalog?as=supplier-1');
      });

      expect(location.read().searchParams.get('as')).toBe('supplier-1');
      expect(result.current.isLeavePending).toBe(false);
    });

    it('keeps the address and asks again after the user stays', () => {
      const { location, result } = setup(true);

      act(() => {
        location.navigate('/deals');
      });
      act(() => {
        result.current.cancelLeave();
      });

      expect(result.current.isLeavePending).toBe(false);
      expect(location.read().path).toBe('/catalog');

      act(() => {
        location.navigate('/network');
      });

      expect(result.current.isLeavePending).toBe(true);
    });

    it('goes to the held address when the user leaves', () => {
      const { location, result } = setup(true);

      act(() => {
        location.navigate('/deals');
      });
      act(() => {
        result.current.confirmLeave();
      });

      expect(location.read().path).toBe('/deals');
      expect(result.current.isLeavePending).toBe(false);
    });

    it('holds back and goes back when the user leaves', () => {
      const { location, rerender, result } = setup(false);

      act(() => {
        location.navigate('/deals');
      });
      rerender({ isDirty: true });
      act(() => {
        location.back();
      });

      expect(location.currentIndex).toBe(1);
      expect(result.current.isLeavePending).toBe(true);

      act(() => {
        result.current.confirmLeave();
      });

      expect(location.currentIndex).toBe(0);
    });

    it('asks again about the next attempt after the user left and stays on the form', () => {
      const { location, result } = setup(true);

      act(() => {
        location.navigate('/deals');
      });
      act(() => {
        result.current.confirmLeave();
      });
      act(() => {
        location.navigate('/network');
      });

      expect(location.read().path).toBe('/deals');
      expect(result.current.isLeavePending).toBe(true);
    });

    it('does nothing on leave when no one is waiting', () => {
      const { location, result } = setup(true);

      act(() => {
        result.current.confirmLeave();
      });

      expect(location.history).toEqual(['/catalog']);
      expect(result.current.isLeavePending).toBe(false);
    });

    it('holds the unload of the page', () => {
      setup(true);

      expect(dispatchBeforeUnload()).toBe(true);
    });
  });

  describe('requestLeave with unsaved changes', () => {
    it('keeps the action until the user leaves, then runs it once', () => {
      const { result } = setup(true);
      const action = vi.fn();

      act(() => {
        result.current.requestLeave(action);
      });

      expect(action).not.toHaveBeenCalled();
      expect(result.current.isLeavePending).toBe(true);

      act(() => {
        result.current.confirmLeave();
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(result.current.isLeavePending).toBe(false);
    });

    it('drops the action when the user stays', () => {
      const { result } = setup(true);
      const action = vi.fn();

      act(() => {
        result.current.requestLeave(action);
      });
      act(() => {
        result.current.cancelLeave();
      });
      act(() => {
        result.current.confirmLeave();
      });

      expect(action).not.toHaveBeenCalled();
      expect(result.current.isLeavePending).toBe(false);
    });

    it('lets a navigation that came later replace the waiting action', () => {
      const { location, result } = setup(true);
      const action = vi.fn();

      act(() => {
        result.current.requestLeave(action);
      });
      act(() => {
        location.navigate('/deals');
      });
      act(() => {
        result.current.confirmLeave();
      });

      expect(action).not.toHaveBeenCalled();
      expect(location.read().path).toBe('/deals');
    });

    it('does not ask twice when the action itself navigates', () => {
      const { location, result } = setup(true);

      act(() => {
        result.current.requestLeave(() => {
          location.navigate('/deals');
        });
      });
      act(() => {
        result.current.confirmLeave();
      });

      expect(location.read().path).toBe('/deals');
    });
  });

  describe('when the changes are gone', () => {
    it('frees the navigation, drops the question and stops holding the unload', () => {
      const { location, rerender, result } = setup(true);

      act(() => {
        location.navigate('/deals');
      });

      expect(result.current.isLeavePending).toBe(true);

      rerender({ isDirty: false });

      expect(result.current.isLeavePending).toBe(false);

      act(() => {
        location.navigate('/network');
      });

      expect(location.read().path).toBe('/network');
      expect(dispatchBeforeUnload()).toBe(false);
    });

    it('does not bring the old question back when the changes appear again', () => {
      const { location, rerender, result } = setup(true);

      act(() => {
        location.navigate('/deals');
      });
      rerender({ isDirty: false });
      rerender({ isDirty: true });

      expect(result.current.isLeavePending).toBe(false);
    });

    it('stops holding everything after the unmount', () => {
      const { location, unmount } = setup(true);

      unmount();
      location.navigate('/deals');

      expect(location.read().path).toBe('/deals');
      expect(dispatchBeforeUnload()).toBe(false);
    });
  });

  describe('several guards', () => {
    it('asks through the guard that was set last and drops the question when the user leaves', () => {
      const { location, result } = setupPair(true, true);

      act(() => {
        location.navigate('/deals');
      });

      expect(result.current.first.isLeavePending).toBe(false);
      expect(result.current.second.isLeavePending).toBe(true);

      act(() => {
        result.current.second.confirmLeave();
      });

      expect(location.read().path).toBe('/deals');
      expect(result.current.first.isLeavePending).toBe(false);
      expect(result.current.second.isLeavePending).toBe(false);
    });

    it('leaves the guard with a condition out of a move that stays inside its area', () => {
      const { location, result } = setupPair(true, true);

      act(() => {
        location.navigate(LISTING_PATH);
      });

      expect(result.current.first.isLeavePending).toBe(true);
      expect(result.current.second.isLeavePending).toBe(false);

      act(() => {
        result.current.first.confirmLeave();
      });

      expect(location.read().path).toBe(LISTING_PATH);
    });

    it('lets a move inside the area pass when only the guard with the condition has changes', () => {
      const { location, result } = setupPair(false, true);

      act(() => {
        location.navigate(LISTING_PATH);
      });

      expect(location.read().path).toBe(LISTING_PATH);
      expect(result.current.second.isLeavePending).toBe(false);

      act(() => {
        location.navigate('/deals');
      });

      expect(location.read().path).toBe(LISTING_PATH);
      expect(result.current.second.isLeavePending).toBe(true);
    });

    it('drops the question an earlier guard asked on its own when a later guard asks about the address', () => {
      const { location, result } = setupPair(true, true);
      const action = vi.fn();

      act(() => {
        result.current.first.requestLeave(action);
      });

      expect(result.current.first.isLeavePending).toBe(true);

      act(() => {
        location.navigate('/deals');
      });

      expect(result.current.first.isLeavePending).toBe(false);
      expect(result.current.second.isLeavePending).toBe(true);

      act(() => {
        result.current.second.confirmLeave();
      });

      expect(action).not.toHaveBeenCalled();
      expect(location.read().path).toBe('/deals');
    });

    it('keeps the question when the condition is a new function on every render', () => {
      const location = createMemoryLocation('/catalog');
      const { rerender, result } = renderHook(
        () => useNavigationGuard(true, next => isOutsideCatalog(next)),
        {
          wrapper: ({ children }: { children: ReactNode }) => <RoutingProvider location={location}>{children}</RoutingProvider>,
        },
      );

      act(() => {
        location.navigate('/deals');
      });

      rerender();

      expect(result.current.isLeavePending).toBe(true);

      act(() => {
        result.current.confirmLeave();
      });

      expect(location.read().path).toBe('/deals');
    });
  });
});
