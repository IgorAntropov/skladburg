import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { useNetworkMapStore } from './useNetworkMapStore';

describe('useNetworkMapStore', () => {
  beforeEach(() => {
    useNetworkMapStore.setState({
      focusCommand: undefined,
      hoveredId: undefined,
      hoveredOrganizationId: undefined,
    });
  });

  it('counts focus commands across objects and organizations', () => {
    const { requestFocus, requestOrganizationFocus } = useNetworkMapStore.getState();

    requestFocus('site-1');
    expect(useNetworkMapStore.getState().focusCommand).toEqual({ id: 'site-1', isOrganization: false, sequence: 1 });

    requestOrganizationFocus('org-1');
    expect(useNetworkMapStore.getState().focusCommand).toEqual({ id: 'org-1', isOrganization: true, sequence: 2 });

    requestOrganizationFocus('org-1');
    expect(useNetworkMapStore.getState().focusCommand?.sequence).toBe(3);
  });

  it('clears the hovered organization only for the same id', () => {
    const { clearHoveredOrganizationId, setHoveredOrganizationId } = useNetworkMapStore.getState();

    setHoveredOrganizationId('org-1');
    clearHoveredOrganizationId('org-2');
    expect(useNetworkMapStore.getState().hoveredOrganizationId).toBe('org-1');

    clearHoveredOrganizationId('org-1');
    expect(useNetworkMapStore.getState().hoveredOrganizationId).toBeUndefined();
  });

  it('keeps the hovered object independent of the hovered organization', () => {
    const { setHoveredId, setHoveredOrganizationId } = useNetworkMapStore.getState();

    setHoveredId('site-1');
    setHoveredOrganizationId('org-1');
    useNetworkMapStore.getState().clearHoveredOrganizationId('org-1');

    expect(useNetworkMapStore.getState().hoveredId).toBe('site-1');
  });
});
