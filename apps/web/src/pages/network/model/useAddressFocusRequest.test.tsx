import type { ReactNode } from 'react';

import {
  act,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { ObjectRefValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { useAddressFocusRequest } from './useAddressFocusRequest';
import { useNetworkMapStore } from './useNetworkMapStore';

const SITE_ID = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000002';
const DEAL_ID = '00000000-0000-4000-8000-000000000003';

const SITE_FOCUS: ObjectRefValue = { id: SITE_ID, type: 'site' };

let viewport: IFakeViewport | undefined;

const setup = (
  focus: ObjectRefValue | undefined,
  viewportClass: 'desktop' | 'phone' | 'tablet' = 'desktop',
): { location: IMemoryLocation } => {
  viewport = installFakeViewport(viewportClass);

  const location = createMemoryLocation('/network');

  renderHook(
    () => {
      useAddressFocusRequest(focus);
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => <RoutingProvider location={location}>{children}</RoutingProvider>,
    },
  );

  return { location };
};

describe('useAddressFocusRequest', () => {
  beforeEach(() => {
    useNetworkMapStore.setState({ focusCommand: undefined });
  });

  afterEach(() => {
    viewport?.restore();
    viewport = undefined;
  });

  it('does not fly on the first mount', () => {
    setup(SITE_FOCUS);

    expect(useNetworkMapStore.getState().focusCommand).toBeUndefined();
  });

  it('flies to a site when a navigation asks for the camera', () => {
    const { location } = setup(SITE_FOCUS);

    act(() => {
      location.navigate(`/network/site/${SITE_ID}`, { isFocusRequested: true });
    });

    expect(useNetworkMapStore.getState().focusCommand).toMatchObject({ id: SITE_ID, isOrganization: false });
  });

  it('flies to the sites of a company when the focus is an organization', () => {
    const { location } = setup({ id: ORGANIZATION_ID, type: 'organization' });

    act(() => {
      location.navigate(`/network/organization/${ORGANIZATION_ID}`, { isFocusRequested: true });
    });

    expect(useNetworkMapStore.getState().focusCommand).toMatchObject({ id: ORGANIZATION_ID, isOrganization: true });
  });

  it('flies again when the same object is requested twice', () => {
    const { location } = setup(SITE_FOCUS);

    act(() => {
      location.navigate(`/network/site/${SITE_ID}`, { isFocusRequested: true });
    });
    act(() => {
      location.navigate(`/network/site/${SITE_ID}`, { isFocusRequested: true });
    });

    expect(useNetworkMapStore.getState().focusCommand?.sequence).toBe(2);
  });

  it('does not fly on a navigation without the intent', () => {
    const { location } = setup(SITE_FOCUS);

    act(() => {
      location.navigate(`/network/site/${SITE_ID}`);
    });

    expect(useNetworkMapStore.getState().focusCommand).toBeUndefined();
  });

  it('does not fly when going back', () => {
    const { location } = setup(SITE_FOCUS);

    act(() => {
      location.navigate(`/network/site/${SITE_ID}`, { isFocusRequested: true });
    });
    const sequenceBeforeBack = useNetworkMapStore.getState().focusCommand?.sequence;

    act(() => {
      location.back();
    });

    expect(useNetworkMapStore.getState().focusCommand?.sequence).toBe(sequenceBeforeBack);
  });

  it('does not fly to an object that is not on the map', () => {
    const { location } = setup({ id: DEAL_ID, type: 'deal' });

    act(() => {
      location.navigate(`/deals/${DEAL_ID}`, { isFocusRequested: true });
    });

    expect(useNetworkMapStore.getState().focusCommand).toBeUndefined();
  });

  it('does not fly on a phone, where the link only opens the card', () => {
    const { location } = setup(SITE_FOCUS, 'phone');

    act(() => {
      location.navigate(`/network/site/${SITE_ID}`, { isFocusRequested: true });
    });

    expect(useNetworkMapStore.getState().focusCommand).toBeUndefined();
  });
});
