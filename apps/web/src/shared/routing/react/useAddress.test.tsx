import type {
  ReactElement,
  ReactNode,
} from 'react';

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

import type { ILocationSource } from '../location/locationTypes';

import { createMemoryLocation } from '../location/testing/createMemoryLocation';
import { RoutingProvider } from './RoutingProvider';
import { useAddress } from './useAddress';
import { useNavigate } from './useNavigate';
import { useReloadPage } from './useReloadPage';

const DEAL_ID = '00000000-0000-4000-8000-000000000001';

const createWrapper = (location: ILocationSource): (props: { children: ReactNode }) => ReactElement => {
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <RoutingProvider location={location}>{children}</RoutingProvider>
  );

  return Wrapper;
};

describe('useAddress', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns the parsed address, the raw path and the parameters', () => {
    const location = createMemoryLocation(`/deals/${DEAL_ID}?as=customer-1`);

    const { result } = renderHook(useAddress, { wrapper: createWrapper(location) });

    expect(result.current.address).toEqual({ kind: 'object', object: { id: DEAL_ID, type: 'deal' } });
    expect(result.current.path).toBe(`/deals/${DEAL_ID}`);
    expect(result.current.searchParams.get('as')).toBe('customer-1');
  });

  it('returns an undefined address for an unknown path and keeps the raw path', () => {
    const location = createMemoryLocation('/nope');

    const { result } = renderHook(useAddress, { wrapper: createWrapper(location) });

    expect(result.current.address).toBeUndefined();
    expect(result.current.path).toBe('/nope');
  });

  it('updates when the location changes and keeps the same result otherwise', () => {
    const location = createMemoryLocation('/');
    const { rerender, result } = renderHook(useAddress, { wrapper: createWrapper(location) });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);

    act(() => {
      location.navigate('/catalog');
    });

    expect(result.current.address).toEqual({ kind: 'section', section: 'catalog' });
    expect(result.current).not.toBe(first);
  });

  it('stops listening after unmount', () => {
    const location = createMemoryLocation('/');
    const unsubscribe = vi.fn();
    const subscribe = vi.spyOn(location, 'subscribe').mockReturnValue(unsubscribe);

    const { unmount } = renderHook(useAddress, { wrapper: createWrapper(location) });
    unmount();

    expect(subscribe).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('throws outside of the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(useAddress)).toThrow('Routing hooks must be used inside RoutingProvider');

    consoleError.mockRestore();
  });
});

describe('useNavigate', () => {
  afterEach(() => {
    cleanup();
  });

  it('navigates to the formatted path', () => {
    const location = createMemoryLocation('/');
    const { result } = renderHook(() => ({ address: useAddress(), navigate: useNavigate() }), { wrapper: createWrapper(location) });

    act(() => {
      result.current.navigate({ kind: 'object', object: { id: DEAL_ID, type: 'cell' } });
    });

    expect(location.history).toEqual(['/', `/cells/${DEAL_ID}`]);
    expect(result.current.address.address).toEqual({ kind: 'object', object: { id: DEAL_ID, type: 'cell' } });
  });

  it('passes the replace option', () => {
    const location = createMemoryLocation('/');
    const { result } = renderHook(useNavigate, { wrapper: createWrapper(location) });

    act(() => {
      result.current({ kind: 'section', section: 'network' }, { isReplace: true });
    });

    expect(location.history).toEqual(['/network']);
  });

  it('keeps the same function between renders', () => {
    const location = createMemoryLocation('/');
    const { rerender, result } = renderHook(useNavigate, { wrapper: createWrapper(location) });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

describe('useReloadPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('reloads through the location source', () => {
    const location = createMemoryLocation('/');
    const { result } = renderHook(useReloadPage, { wrapper: createWrapper(location) });

    result.current();

    expect(location.reloadCount).toBe(1);
  });
});
