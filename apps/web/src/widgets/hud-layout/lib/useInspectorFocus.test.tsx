import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ObjectRefValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import type { InspectorFocusValue } from './useInspectorFocus';

import { useInspectorFocus } from './useInspectorFocus';

const OBJECT: ObjectRefValue = { id: 'f6000001-0000-4000-8000-000000000000', type: 'deal' };

const OTHER_OBJECT: ObjectRefValue = { id: 'f6000002-0000-4000-8000-000000000000', type: 'warehouse' };

interface RenderedFocusValue {
  location: IMemoryLocation;
  readFocus: () => InspectorFocusValue;
}

const renderFocusHook = (focus: ObjectRefValue | undefined): RenderedFocusValue => {
  const location = createMemoryLocation('/catalog');
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <RoutingProvider location={location}>{children}</RoutingProvider>
  );
  const { result } = renderHook(() => useInspectorFocus('deals', focus), { wrapper });

  return { location, readFocus: () => result.current };
};

describe('useInspectorFocus', () => {
  afterEach(() => {
    cleanup();
  });

  it('is closed and has no key without an object', () => {
    const { readFocus } = renderFocusHook(undefined);

    expect(readFocus().isInspectorOpen).toBe(false);
    expect(readFocus().inspectorKey).toBeUndefined();
  });

  it('is open and keyed by the type and the identifier with an object', () => {
    const { readFocus } = renderFocusHook(OBJECT);

    expect(readFocus().isInspectorOpen).toBe(true);
    expect(readFocus().inspectorKey).toBe(`${OBJECT.type}:${OBJECT.id}`);
  });

  it('changes the key when another object is opened', () => {
    const first = renderFocusHook(OBJECT).readFocus().inspectorKey;
    const second = renderFocusHook(OTHER_OBJECT).readFocus().inspectorKey;

    expect(first).not.toBe(second);
  });

  it('closes into its section without an object', () => {
    const { location, readFocus } = renderFocusHook(OBJECT);

    readFocus().onInspectorClose();

    expect(location.history).toEqual(['/catalog', '/deals']);
  });
});
