import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  bundledLocales,
  catalogLoaders,
  defaultTenant,
} from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TenantSettingsValue } from '@/shared/tenant';

import { App } from './App';
import { loadAppContext } from './bootstrap/loadAppContext';

const OVERRIDDEN_PLACEHOLDER = 'Склад «Север» скоро откроется';

const renderApp = async (tenant: TenantSettingsValue = defaultTenant): Promise<string> => {
  const { localizer, tenantSettings } = await loadAppContext({ bundledLocales, catalogLoaders, defaultTenant: tenant });

  render(<App localizer={localizer} tenantSettings={tenantSettings} />);

  return localizer.getSnapshot().t('field.placeholder');
};

describe('App', () => {
  beforeEach(() => {
    document.title = '';
    document.documentElement.lang = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the main landmark', async () => {
    await renderApp();

    expect(screen.getByRole('main')).toBeDefined();
  });

  it('renders the brand name excluded from translation', async () => {
    await renderApp();

    const brand = screen.getByRole('heading', { name: defaultTenant.brandName });

    expect(brand.getAttribute('translate')).toBe('no');
  });

  it('renders the placeholder from the locale catalog', async () => {
    const placeholder = await renderApp();

    expect(placeholder).not.toBe('field.placeholder');
    expect(screen.getByText(placeholder)).toBeDefined();
  });

  it('applies the term override of the company without code changes', async () => {
    const tenant: TenantSettingsValue = {
      ...defaultTenant,
      termOverrides: { [defaultTenant.defaultLocale]: { 'field.placeholder': OVERRIDDEN_PLACEHOLDER } },
    };

    await renderApp(tenant);

    expect(screen.getByText(OVERRIDDEN_PLACEHOLDER)).toBeDefined();
  });

  it('sets the document language and title', async () => {
    await renderApp();

    expect(document.documentElement.lang).toBe(defaultTenant.defaultLocale);
    expect(document.title).toBe(defaultTenant.brandName);
  });

  it('uses the brand name of the company in the title', async () => {
    await renderApp({ ...defaultTenant, brandName: 'Северный склад' });

    expect(document.title).toBe('Северный склад');
    expect(screen.getByRole('heading', { name: 'Северный склад' })).toBeDefined();
  });
});
