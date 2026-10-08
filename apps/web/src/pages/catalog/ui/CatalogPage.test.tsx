import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ILocalizer } from '@/shared/i18n';
import type { ObjectRefValue } from '@/shared/routing';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { OBJECT_TYPES } from '@/shared/routing';

import { CatalogPage } from './CatalogPage';

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const renderPage = async (focus: ObjectRefValue | undefined): Promise<void> => {
  const localizer = await createTestLocalizer();

  render(
    <LocalizerProvider localizer={localizer}>
      <CatalogPage focus={focus} />
    </LocalizerProvider>,
  );
};

describe('CatalogPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the title of the section and the placeholder', async () => {
    await renderPage(undefined);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(defaultLocaleCatalog['section.catalog.title']);
    expect(screen.getByText(defaultLocaleCatalog['section.catalog.placeholder'])).toBeDefined();
  });

  it('does not render a landmark of its own', async () => {
    await renderPage(undefined);

    expect(screen.queryByRole('main')).toBeNull();
  });

  it('does not name an object when there is none in the address', async () => {
    await renderPage(undefined);

    expect(screen.queryByText(OBJECT_ID)).toBeNull();
    expect(screen.queryByText(defaultLocaleCatalog['routing.focusedObject'].replace(': {type}', ''), { exact: false })).toBeNull();
  });

  it.each(OBJECT_TYPES)('names the opened object of the type %s and keeps its identifier out of translation', async (type) => {
    await renderPage({ id: OBJECT_ID, type });

    const identifier = screen.getByText(OBJECT_ID);

    expect(identifier.getAttribute('translate')).toBe('no');
    expect(identifier.closest('p')?.textContent).toBe(
      `${defaultLocaleCatalog['routing.focusedObject'].replace('{type}', defaultLocaleCatalog[`object.type.${type}`])} ${OBJECT_ID}`,
    );
  });
});
