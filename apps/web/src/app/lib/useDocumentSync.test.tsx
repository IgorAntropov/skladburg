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
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type {
  ILocalizer,
  LocaleCatalogValue,
} from '@/shared/i18n';
import type { TenantSettingsValue } from '@/shared/tenant';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { TenantSettingsProvider } from '@/shared/tenant';

import { useDocumentSync } from './useDocumentSync';

const catalog: LocaleCatalogValue = {
  'app.startError.message': 'Не удалось запустить приложение',
  'app.startError.retry': 'Повторить',
  'app.startError.retrying': 'Повторяем…',
  'field.placeholder': 'Скоро здесь будет склад',
  'units.pallet': { few: '{count} паллеты', many: '{count} паллет', one: '{count} паллета', other: '{count} паллеты' },
};

const enCatalog: LocaleCatalogValue = {
  'app.startError.message': 'The application failed to start',
  'app.startError.retry': 'Retry',
  'app.startError.retrying': 'Retrying…',
  'field.placeholder': 'A warehouse is coming soon',
  'units.pallet': { one: '{count} pallet', other: '{count} pallets' },
};

const tenantSettings: TenantSettingsValue = {
  availableLocales: ['ru', 'en'],
  brandName: 'Северный склад',
  defaultLocale: 'ru',
  tenantId: 'north-warehouse',
  termOverrides: {},
};

const createTestLocalizer = (): Promise<ILocalizer> => {
  return createLocalizer({
    bundledLocales: ['ru', 'en'],
    catalogLoaders: { en: () => Promise.resolve(enCatalog), ru: () => Promise.resolve(catalog) },
    requestedLocale: undefined,
    tenant: tenantSettings,
  });
};

const createWrapper = (localizer: ILocalizer, settings: TenantSettingsValue) => {
  return ({ children }: { children: ReactNode }): ReactElement => (
    <LocalizerProvider localizer={localizer}>
      <TenantSettingsProvider tenantSettings={settings}>{children}</TenantSettingsProvider>
    </LocalizerProvider>
  );
};

describe('useDocumentSync', () => {
  beforeEach(() => {
    document.title = '';
    document.documentElement.lang = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('sets the document language and title', async () => {
    const localizer = await createTestLocalizer();

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings) });

    expect(document.documentElement.lang).toBe('ru');
    expect(document.title).toBe('Северный склад');
  });

  it('follows the active locale', async () => {
    const localizer = await createTestLocalizer();

    renderHook(useDocumentSync, { wrapper: createWrapper(localizer, tenantSettings) });
    await act(() => localizer.setLocale('en'));

    expect(document.documentElement.lang).toBe('en');
  });
});
