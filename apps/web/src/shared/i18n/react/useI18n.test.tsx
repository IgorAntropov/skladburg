import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  LocaleCatalogValue,
  LocalizerOptionsValue,
} from '../localizer/localizationTypes';

import { catalog as ruCatalog } from '../catalogs/ru';
import { createLocalizer } from '../localizer/createLocalizer';
import { LocalizerProvider } from './LocalizerProvider';
import { useI18n } from './useI18n';

const enCatalog: LocaleCatalogValue = {
  ...ruCatalog,
  'app.startError.message': 'Failed to start the application',
  'common.retry': 'Retry',
  'common.retrying': 'Retrying…',
  'units.pallet': { one: '{count} pallet', other: '{count} pallets' },
  'warehouse.placeholder': 'A living world is coming soon',
};

const createOptions = (): LocalizerOptionsValue => ({
  bundledLocales: ['ru', 'en'],
  catalogLoaders: {
    en: () => Promise.resolve(enCatalog),
    ru: () => Promise.resolve(ruCatalog),
  },
  requestedLocale: undefined,
  tenant: {
    availableLocales: ['ru', 'en'],
    defaultLocale: 'ru',
    termOverrides: {},
  },
  userTimeZone: 'UTC',
});

const Probe = (): ReactElement => {
  const { locale, t } = useI18n();

  return (
    <p data-locale={locale} data-testid="probe">
      {t('units.pallet', { count: 5 })}
    </p>
  );
};

describe('useI18n', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders translated text from the provider', async () => {
    const localizer = await createLocalizer(createOptions());

    render(
      <LocalizerProvider localizer={localizer}>
        <Probe />
      </LocalizerProvider>,
    );

    expect(screen.getByTestId('probe').textContent).toBe('5 паллет');
  });

  it('re-renders after setLocale', async () => {
    const localizer = await createLocalizer(createOptions());

    render(
      <LocalizerProvider localizer={localizer}>
        <Probe />
      </LocalizerProvider>,
    );
    await act(() => localizer.setLocale('en'));

    expect(screen.getByTestId('probe').textContent).toBe('5 pallets');
    expect(screen.getByTestId('probe').getAttribute('data-locale')).toBe('en');
  });

  it('re-renders after applyTenant', async () => {
    const localizer = await createLocalizer(createOptions());

    render(
      <LocalizerProvider localizer={localizer}>
        <Probe />
      </LocalizerProvider>,
    );
    await act(() => localizer.applyTenant({
      availableLocales: ['ru', 'en'],
      defaultLocale: 'ru',
      termOverrides: {
        ru: { 'units.pallet': { few: '{count} поддона', many: '{count} поддонов', one: '{count} поддон', other: '{count} поддона' } },
      },
    }));

    expect(screen.getByTestId('probe').textContent).toBe('5 поддонов');
  });

  it('returns a stable snapshot between renders without changes', async () => {
    const localizer = await createLocalizer(createOptions());
    const { rerender, result } = renderHook(useI18n, {
      wrapper: ({ children }) => <LocalizerProvider localizer={localizer}>{children}</LocalizerProvider>,
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('throws outside of the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(useI18n)).toThrow('useI18n must be used inside LocalizerProvider');

    consoleError.mockRestore();
  });
});
