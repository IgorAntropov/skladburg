import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IIsometricCameraRig } from '@/shared/3d';

import { SceneCameraRigProvider } from '@/shared/3d';

import type {
  NetworkFocusRequestValue,
  NetworkSceneInteractionValue,
} from '../../model/networkSceneInteraction';
import type { NetworkSceneLayoutValue } from '../layout';

import { buildNetworkSceneLayout } from '../layout';
import {
  createTestCity,
  createTestModel,
  createTestSite,
} from '../layout/layoutTestSupport';
import {
  resolveFocusZoomFactor,
  resolveNetworkFocusTarget,
} from './resolveNetworkFocusTarget';
import { useNetworkCameraFocus } from './useNetworkCameraFocus';

interface HookPropsValue {
  interaction: NetworkSceneInteractionValue | undefined;
  layout: NetworkSceneLayoutValue;
}

const createRig = (): IIsometricCameraRig => ({
  flyTo: vi.fn(),
  follow: vi.fn(),
  home: vi.fn(),
  rotate: vi.fn(),
  zoom: vi.fn(),
});

const createLayout = (siteIds: readonly string[]): NetworkSceneLayoutValue => buildNetworkSceneLayout(createTestModel(
  [createTestCity('a', 4, 2), createTestCity('b', 7, 3)],
  [],
  siteIds.map(id => createTestSite(id, id.startsWith('b') ? 'b' : 'a')),
));

const createRequest = (id: string, sequence: number): NetworkFocusRequestValue => ({ id, sequence, siteIds: undefined });

const createInteraction = (overrides: Partial<NetworkSceneInteractionValue> = {}): NetworkSceneInteractionValue => ({
  focusRequest: undefined,
  hoveredId: undefined,
  hoveredSiteIds: [],
  onHoverEnd: vi.fn(),
  onHoverStart: vi.fn(),
  onSelect: vi.fn(),
  selected: undefined,
  ...overrides,
});

const renderFocus = (
  rigRef: { current: IIsometricCameraRig | null },
  initialProps: HookPropsValue,
): ReturnType<typeof renderHook<void, HookPropsValue>> => renderHook(
  ({ interaction, layout }: HookPropsValue) => {
    useNetworkCameraFocus(layout, interaction);
  },
  {
    initialProps,
    wrapper: ({ children }): ReactElement => <SceneCameraRigProvider rigRef={rigRef}>{children}</SceneCameraRigProvider>,
  },
);

const expectFlyToSite = (
  rig: IIsometricCameraRig,
  layout: NetworkSceneLayoutValue,
  id: string,
  callIndex = 0,
  siteIds?: readonly string[],
): void => {
  const target = resolveNetworkFocusTarget(layout, id, siteIds);

  expect(target).toBeDefined();
  expect(rig.flyTo).toHaveBeenNthCalledWith(callIndex + 1, target?.point, {
    zoom: resolveFocusZoomFactor(layout.world.home.radius, target?.radius ?? 0),
  });
};

describe('useNetworkCameraFocus', () => {
  const layout = createLayout(['a-1', 'a-2', 'b-1']);

  it('flies once to the selected object when it mounts with one', () => {
    const rig = createRig();

    renderFocus({ current: rig }, { interaction: createInteraction({ selected: { id: 'b-1', kind: 'site' } }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'b-1');
  });

  it('flies to a selected city when it mounts with one', () => {
    const rig = createRig();

    renderFocus({ current: rig }, { interaction: createInteraction({ selected: { id: 'a', kind: 'city' } }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'a');
  });

  it('counts the focus request it mounts with as handled and does not fly twice', () => {
    const rig = createRig();
    const selected = { id: 'b-1', kind: 'site' } as const;
    const { rerender } = renderFocus({ current: rig }, {
      interaction: createInteraction({ focusRequest: createRequest('b-1', 4), selected }),
      layout,
    });

    rerender({ interaction: createInteraction({ focusRequest: createRequest('b-1', 4), hoveredId: 'a-1', selected }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
  });

  it('does not fly when it mounts with an old request and nothing selected', () => {
    const rig = createRig();

    renderFocus({ current: rig }, { interaction: createInteraction({ focusRequest: createRequest('b-1', 9) }), layout });

    expect(rig.flyTo).not.toHaveBeenCalled();
  });

  it('flies to the object of a new request and ignores the same number again', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ focusRequest: createRequest('a-2', 1) }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'a-2');

    rerender({ interaction: createInteraction({ focusRequest: createRequest('a-2', 1), hoveredId: 'b-1' }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);

    rerender({ interaction: createInteraction({ focusRequest: createRequest('a-2', 2) }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(2);
    expectFlyToSite(rig, layout, 'a-2', 1);
  });

  it('flies to a request for a city', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ focusRequest: createRequest('b', 1) }), layout });

    expectFlyToSite(rig, layout, 'b');
  });

  it('does not fly when the selected address changes without a request', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ selected: { id: 'a-1', kind: 'site' } }), layout });
    rerender({ interaction: createInteraction({ selected: { id: 'b-1', kind: 'site' } }), layout });
    rerender({ interaction: createInteraction(), layout });

    expect(rig.flyTo).not.toHaveBeenCalled();
  });

  it('waits for the layout that has the requested id and flies once it comes', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ focusRequest: createRequest('late', 1) }), layout });

    expect(rig.flyTo).not.toHaveBeenCalled();

    const nextLayout = createLayout(['a-1', 'late']);

    rerender({ interaction: createInteraction({ focusRequest: createRequest('late', 1) }), layout: nextLayout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, nextLayout, 'late');

    rerender({ interaction: createInteraction({ focusRequest: createRequest('late', 1) }), layout: createLayout(['a-1', 'late']) });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
  });

  it('waits for the layout that has the object selected at the mount', () => {
    const rig = createRig();
    const selected = { id: 'late', kind: 'site' } as const;
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction({ selected }), layout });

    expect(rig.flyTo).not.toHaveBeenCalled();

    const nextLayout = createLayout(['late']);

    rerender({ interaction: createInteraction({ selected }), layout: nextLayout });

    expectFlyToSite(rig, nextLayout, 'late');
  });

  it('drops the wait for the object selected at the mount when another address is selected', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, {
      interaction: createInteraction({ selected: { id: 'late', kind: 'site' } }),
      layout,
    });

    rerender({ interaction: createInteraction({ selected: { id: 'a-1', kind: 'site' } }), layout });
    rerender({ interaction: createInteraction({ selected: { id: 'late', kind: 'site' } }), layout: createLayout(['late']) });

    expect(rig.flyTo).not.toHaveBeenCalled();
  });

  it('cancels a waiting request with a new one', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ focusRequest: createRequest('late', 1) }), layout });
    rerender({ interaction: createInteraction({ focusRequest: createRequest('a-1', 2) }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'a-1');

    rerender({ interaction: createInteraction({ focusRequest: createRequest('a-1', 2) }), layout: createLayout(['a-1', 'late']) });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the selected object is gone from the data', () => {
    const rig = createRig();
    const selected = { id: 'b-1', kind: 'site' } as const;
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction({ selected }), layout });

    rerender({ interaction: createInteraction({ selected }), layout: createLayout(['a-1']) });
    rerender({ interaction: createInteraction({ selected }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
  });

  it('keeps the request until the rig is ready and runs it on the next layout or interaction', () => {
    const rig = createRig();
    const rigRef: { current: IIsometricCameraRig | null } = { current: null };
    const { rerender } = renderFocus(rigRef, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ focusRequest: createRequest('a-1', 1) }), layout });

    expect(rig.flyTo).not.toHaveBeenCalled();

    rigRef.current = rig;
    rerender({ interaction: createInteraction({ focusRequest: createRequest('a-1', 1), hoveredId: 'b-1' }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'a-1');
  });

  it('keeps the selected object of the mount until the rig is ready', () => {
    const rig = createRig();
    const rigRef: { current: IIsometricCameraRig | null } = { current: null };
    const selected = { id: 'a-2', kind: 'site' } as const;
    const { rerender } = renderFocus(rigRef, { interaction: createInteraction({ selected }), layout });

    expect(rig.flyTo).not.toHaveBeenCalled();

    rigRef.current = rig;
    rerender({ interaction: createInteraction({ selected }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
  });

  it('does nothing without interaction and treats the first interaction as the mount', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, { interaction: undefined, layout });

    expect(rig.flyTo).not.toHaveBeenCalled();

    rerender({
      interaction: createInteraction({ focusRequest: createRequest('a-1', 3), selected: { id: 'b-1', kind: 'site' } }),
      layout,
    });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'b-1');
  });

  it('flies to the circle around all the sites of a request with a list of sites', () => {
    const rig = createRig();
    const siteIds = ['a-1', 'b-1'];
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ focusRequest: { id: 'organization', sequence: 1, siteIds } }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'organization', 0, siteIds);
    expect(rig.flyTo).not.toHaveBeenCalledWith(resolveNetworkFocusTarget(layout, 'a-1', undefined)?.point, expect.anything());
  });

  it('flies to all the sites when it mounts with a selected group of sites', () => {
    const rig = createRig();
    const siteIds = ['a-1', 'a-2', 'b-1'];
    const selected = { id: 'organization', kind: 'sites', siteIds } as const;

    renderFocus({ current: rig }, { interaction: createInteraction({ selected }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, layout, 'organization', 0, siteIds);
  });

  it('counts the request of a group it mounts with as handled', () => {
    const rig = createRig();
    const siteIds = ['a-1', 'b-1'];
    const selected = { id: 'organization', kind: 'sites', siteIds } as const;
    const focusRequest = { id: 'organization', sequence: 2, siteIds };
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction({ focusRequest, selected }), layout });

    rerender({ interaction: createInteraction({ focusRequest, hoveredId: 'a-1', selected }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
  });

  it('flies again for a new sequence of the same group and not for the same one', () => {
    const rig = createRig();
    const siteIds = ['a-1', 'b-1'];
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout });

    rerender({ interaction: createInteraction({ focusRequest: { id: 'organization', sequence: 1, siteIds } }), layout });
    rerender({ interaction: createInteraction({ focusRequest: { id: 'organization', sequence: 1, siteIds } }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);

    rerender({ interaction: createInteraction({ focusRequest: { id: 'organization', sequence: 2, siteIds } }), layout });

    expect(rig.flyTo).toHaveBeenCalledTimes(2);
    expectFlyToSite(rig, layout, 'organization', 1, siteIds);
  });

  it('waits for a layout that has a site of the group and then flies around the known ones', () => {
    const rig = createRig();
    const siteIds = ['late', 'a-1'];
    const { rerender } = renderFocus({ current: rig }, { interaction: createInteraction(), layout: createLayout(['b-1']) });

    rerender({
      interaction: createInteraction({ focusRequest: { id: 'organization', sequence: 1, siteIds } }),
      layout: createLayout(['b-1']),
    });

    expect(rig.flyTo).not.toHaveBeenCalled();

    const nextLayout = createLayout(['a-1', 'late']);

    rerender({ interaction: createInteraction({ focusRequest: { id: 'organization', sequence: 1, siteIds } }), layout: nextLayout });

    expect(rig.flyTo).toHaveBeenCalledTimes(1);
    expectFlyToSite(rig, nextLayout, 'organization', 0, siteIds);
  });

  it('drops the wait for a group selected at the mount when another address is selected', () => {
    const rig = createRig();
    const { rerender } = renderFocus({ current: rig }, {
      interaction: createInteraction({ selected: { id: 'organization', kind: 'sites', siteIds: ['late'] } }),
      layout,
    });

    rerender({ interaction: createInteraction({ selected: { id: 'a-1', kind: 'site' } }), layout });
    rerender({
      interaction: createInteraction({ selected: { id: 'organization', kind: 'sites', siteIds: ['late'] } }),
      layout: createLayout(['late']),
    });

    expect(rig.flyTo).not.toHaveBeenCalled();
  });
});
