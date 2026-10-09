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

import { CatalogPage } from './CatalogPage';

const catalog = defaultLocaleCatalog;

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

const renderPage = (focus: ObjectRefValue | undefined): IMemoryLocation => {
  const location = createMemoryLocation('/catalog');

  render(
    withTestLocalizer(
      <RoutingProvider location={location}>
        <CatalogPage focus={focus} />
      </RoutingProvider>,
    ),
  );

  return location;
};

describe('CatalogPage', () => {
  let viewport: IFakeViewport;

  beforeEach(() => {
    viewport = installFakeViewport('desktop');
  });

  afterEach(() => {
    cleanup();
    viewport.restore();
  });

  it('shows the title of the section as the first level heading of the work panel', () => {
    renderPage(undefined);

    const heading = screen.getByRole('heading', { level: 1 });

    expect(heading.textContent).toBe(catalog['section.catalog.title']);
    expect(within(screen.getByTestId('hud-zone-panel')).getByRole('heading', { level: 1 })).toBe(heading);
  });

  it('shows the placeholder of the section in the work panel', () => {
    renderPage(undefined);

    expect(within(screen.getByTestId('hud-zone-panel')).getByText(catalog['section.catalog.placeholder'])).toBeDefined();
  });

  it('does not render a landmark of its own', () => {
    renderPage(undefined);

    expect(screen.queryByRole('main')).toBeNull();
  });

  it.each(['scene', 'panel', 'inspector'])('draws the %s zone on a desktop', (zone) => {
    renderPage(undefined);

    expect(screen.getByTestId(`hud-zone-${zone}`)).toBeDefined();
  });

  it.each(['kpi', 'tracker', 'lists'])('draws no %s zone', (zone) => {
    renderPage(undefined);

    expect(screen.queryByTestId(`hud-zone-${zone}`)).toBeNull();
  });

  it('shows the empty inspector when there is no object in the address', () => {
    renderPage(undefined);

    expect(within(screen.getByTestId('hud-zone-inspector')).getByText(catalog['hud.inspector.empty'])).toBeDefined();
    expect(screen.queryByText(OBJECT_ID)).toBeNull();
  });

  it.each(OBJECT_TYPES)('names the opened object of the type %s in the inspector and keeps its identifier out of translation', (type) => {
    renderPage({ id: OBJECT_ID, type });

    const identifier = within(screen.getByTestId('hud-zone-inspector')).getByText(OBJECT_ID);

    expect(identifier.getAttribute('translate')).toBe('no');
    expect(identifier.closest('p')?.textContent).toBe(
      `${catalog['hud.inspector.object'].replace('{type}', catalog[`object.type.${type}`])} ${OBJECT_ID}`,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(catalog['section.catalog.title']);
  });

  it('leads to the section without an object when the inspector is closed', () => {
    const location = renderPage({ id: OBJECT_ID, type: 'deal' });

    fireEvent.click(screen.getByRole('button', { name: catalog['hud.inspector.close'] }));

    expect(location.history).toEqual(['/catalog', '/catalog']);
  });

  it('keeps the work panel as the main zone on a phone and opens the object in the sheet', () => {
    viewport.setViewportClass('phone');
    renderPage({ id: OBJECT_ID, type: 'deal' });

    const panelHeading = within(screen.getByTestId('hud-zone-panel')).getByRole('heading', { level: 1 });

    expect(panelHeading.textContent).toBe(catalog['section.catalog.title']);
    expect(within(screen.getByTestId('hud-inspector-sheet')).getByText(OBJECT_ID)).toBeDefined();
  });
});
