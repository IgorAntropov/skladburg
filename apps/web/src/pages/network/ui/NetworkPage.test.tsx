import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ViewportClassValue } from '@/shared/lib/viewport';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { ObjectRefValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import {
  OBJECT_TYPES,
  RoutingProvider,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { NetworkPage } from './NetworkPage';

const catalog = defaultLocaleCatalog;

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

const renderPage = (focus: ObjectRefValue | undefined): IMemoryLocation => {
  const location = createMemoryLocation('/network');

  render(
    withTestLocalizer(
      <RoutingProvider location={location}>
        <NetworkPage focus={focus} />
      </RoutingProvider>,
    ),
  );

  return location;
};

describe('NetworkPage', () => {
  let viewport: IFakeViewport;

  const useViewport = (viewportClass: ViewportClassValue): void => {
    viewport.setViewportClass(viewportClass);
  };

  beforeEach(() => {
    viewport = installFakeViewport('desktop');
  });

  afterEach(() => {
    cleanup();
    viewport.restore();
  });

  describe('heading', () => {
    it('names the section with a first level heading that only screen readers see', () => {
      renderPage(undefined);

      const heading = screen.getByRole('heading', { level: 1 });

      expect(heading.textContent).toBe(catalog['section.network.title']);
      expect(heading.className).toContain('sr-only');
    });

    it('does not render a landmark of its own', () => {
      renderPage(undefined);

      expect(screen.queryByRole('main')).toBeNull();
    });
  });

  describe('on a desktop', () => {
    it.each(['scene', 'kpi', 'tracker', 'lists', 'inspector'])('draws the %s zone', (zone) => {
      renderPage(undefined);

      expect(screen.getByTestId(`hud-zone-${zone}`)).toBeDefined();
    });

    it('draws no work panel', () => {
      renderPage(undefined);

      expect(screen.queryByTestId('hud-zone-panel')).toBeNull();
    });

    it('fills the zones with honest empty states', () => {
      renderPage(undefined);

      expect(within(screen.getByTestId('hud-zone-kpi')).getByText(catalog['hud.kpi.empty'])).toBeDefined();
      expect(within(screen.getByTestId('hud-zone-tracker')).getByText(catalog['hud.tracker.empty'])).toBeDefined();
      expect(within(screen.getByTestId('hud-zone-inspector')).getByText(catalog['hud.inspector.empty'])).toBeDefined();
      expect(within(screen.getByTestId('hud-zone-scene')).getByText(catalog['section.network.placeholder'])).toBeDefined();
    });

    it('offers the deals, the trips and the warehouses as tabs of the lists zone', () => {
      renderPage(undefined);

      const tablist = within(screen.getByTestId('hud-zone-lists')).getByRole('tablist', { name: catalog['hud.lists.label'] });

      expect(within(tablist).getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        catalog['hud.lists.deals'],
        catalog['hud.lists.trips'],
        catalog['hud.lists.warehouses'],
      ]);
    });

    it.each([
      ['deals', 'hud.lists.empty.deals'],
      ['trips', 'hud.lists.empty.trips'],
      ['warehouses', 'hud.lists.empty.warehouses'],
    ] as const)('shows the empty state of the %s tab', (tab, emptyKey) => {
      renderPage(undefined);

      fireEvent.mouseDown(screen.getByRole('tab', { name: catalog[`hud.lists.${tab}`] }));

      expect(screen.getByRole('tabpanel').textContent).toBe(catalog[emptyKey]);
    });

    it('names no object when there is none in the address', () => {
      renderPage(undefined);

      expect(screen.queryByText(OBJECT_ID)).toBeNull();
      expect(screen.queryByRole('button', { name: catalog['hud.inspector.close'] })).toBeNull();
    });

    it.each(OBJECT_TYPES)('names the opened object of the type %s in the inspector and keeps its identifier out of translation', (type) => {
      renderPage({ id: OBJECT_ID, type });

      const identifier = within(screen.getByTestId('hud-zone-inspector')).getByText(OBJECT_ID);

      expect(identifier.getAttribute('translate')).toBe('no');
      expect(identifier.closest('p')?.textContent).toBe(
        `${catalog['hud.inspector.object'].replace('{type}', catalog[`object.type.${type}`])} ${OBJECT_ID}`,
      );
    });

    it('leads to the section without an object when the inspector is closed', () => {
      const location = renderPage({ id: OBJECT_ID, type: 'deal' });

      fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.close'] }));

      expect(location.history).toEqual(['/network', '/network']);
    });
  });

  describe('on a tablet', () => {
    beforeEach(() => {
      useViewport('tablet');
    });

    it('draws no inspector until an object is open', () => {
      renderPage(undefined);

      expect(screen.queryByTestId('hud-zone-inspector')).toBeNull();
    });

    it('slides the inspector in with the opened object', () => {
      renderPage({ id: OBJECT_ID, type: 'trip' });

      expect(within(screen.getByTestId('hud-zone-inspector')).getByText(OBJECT_ID)).toBeDefined();
    });

    it('puts the tracker and the lists into one flat row of four tabs', () => {
      renderPage(undefined);

      const tablist = screen.getByRole('tablist');

      expect(screen.getAllByRole('tablist')).toHaveLength(1);
      expect(tablist.getAttribute('aria-label')).toBe(catalog['hud.bottom.label']);
      expect(within(tablist).getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        catalog['hud.tracker.label'],
        catalog['hud.lists.deals'],
        catalog['hud.lists.trips'],
        catalog['hud.lists.warehouses'],
      ]);
      expect(screen.getByTestId('hud-bottom-tabs').contains(tablist)).toBe(true);
    });

    it('opens on the tracker and shows its honest empty state', () => {
      renderPage(undefined);

      expect(within(screen.getByTestId('hud-zone-tracker')).getByText(catalog['hud.tracker.empty'])).toBeDefined();
      expect(screen.getByRole('tab', { name: catalog['hud.tracker.label'] }).getAttribute('aria-selected')).toBe('true');
    });

    it.each([
      ['deals', 'hud.lists.empty.deals'],
      ['trips', 'hud.lists.empty.trips'],
      ['warehouses', 'hud.lists.empty.warehouses'],
    ] as const)('shows the empty state of the %s tab inside the lists zone', (tab, emptyKey) => {
      renderPage(undefined);

      fireEvent.mouseDown(screen.getByRole('tab', { name: catalog[`hud.lists.${tab}`] }));

      expect(within(screen.getByTestId('hud-zone-lists')).getByText(catalog[emptyKey])).toBeDefined();
      expect(screen.queryByText(catalog['hud.tracker.empty'])).toBeNull();
    });

    it('closes the inspector into the section on Escape', () => {
      const location = renderPage({ id: OBJECT_ID, type: 'trip' });

      fireEvent.keyDown(screen.getByTestId('hud-zone-inspector'), { key: 'Escape' });

      expect(location.history).toEqual(['/network', '/network']);
    });
  });

  describe('on a phone', () => {
    beforeEach(() => {
      useViewport('phone');
    });

    it('makes the lists the only main zone', () => {
      renderPage(undefined);

      expect(screen.getByTestId('hud-zone-lists')).toBeDefined();
      expect(screen.queryByTestId('hud-zone-kpi')).toBeNull();
      expect(screen.queryByTestId('hud-zone-tracker')).toBeNull();
      expect(screen.queryByTestId('hud-zone-panel')).toBeNull();
    });

    it('opens the object in the sheet', () => {
      renderPage({ id: OBJECT_ID, type: 'deal' });

      expect(within(screen.getByTestId('hud-inspector-sheet')).getByText(OBJECT_ID)).toBeDefined();
    });

    it('draws no sheet without an object', () => {
      renderPage(undefined);

      expect(screen.queryByTestId('hud-inspector-sheet')).toBeNull();
    });
  });
});
