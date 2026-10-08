import type { GetOrganizationSettingsResponse } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  GetOrganizationSettingsResponseSchema,
  LocaleTermOverridesSchema,
  MessageOverrideSchema,
  OrganizationService,
  OrganizationSettingsSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  bundledLocales,
  catalogLoaders,
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createQueryClient } from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { createLocalizer } from '@/shared/i18n';

import { App } from './App';

const ORGANIZATION_ID = 'f4000002-0000-4000-8000-000000000000';
const BRAND_NAME = 'Северный склад';
const OVERRIDDEN_PLACEHOLDER = 'Склад «Север» скоро откроется';

interface RenderAppOptionsValue {
  placeholder?: string | undefined;
}

const createSettingsResponse = (placeholder: string | undefined): GetOrganizationSettingsResponse => {
  const termOverrides = placeholder === undefined
    ? []
    : [
        create(LocaleTermOverridesSchema, {
          locale: defaultTenant.defaultLocale,
          messages: { 'field.placeholder': create(MessageOverrideSchema, { value: { case: 'text', value: placeholder } }) },
        }),
      ];

  return create(GetOrganizationSettingsResponseSchema, {
    settings: create(OrganizationSettingsSchema, {
      availableLocales: [defaultTenant.defaultLocale],
      brandName: BRAND_NAME,
      defaultLocale: defaultTenant.defaultLocale,
      organizationId: ORGANIZATION_ID,
      termOverrides,
    }),
  });
};

const renderApp = async ({ placeholder }: RenderAppOptionsValue = {}): Promise<void> => {
  const localizer = await createLocalizer({
    bundledLocales,
    catalogLoaders,
    requestedLocale: undefined,
    tenant: defaultTenant,
    userTimeZone: 'UTC',
  });
  const runtime = createTestRuntime({
    routes: router => router.service(OrganizationService, {
      getOrganizationSettings: () => createSettingsResponse(placeholder),
    }),
  });

  render(<App localizer={localizer} queryClient={createQueryClient({ networkMode: 'always' })} runtime={runtime} />);
};

describe('App', () => {
  beforeEach(() => {
    document.title = '';
    document.documentElement.lang = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('shows an empty busy landmark until the settings of the organization are applied', async () => {
    await renderApp();

    const waiting = screen.getByRole('main', { busy: true });

    expect(waiting.textContent).toBe('');

    await screen.findByRole('heading', { name: BRAND_NAME });
  });

  it('renders the main landmark', async () => {
    await renderApp();

    await screen.findByRole('heading', { name: BRAND_NAME });

    expect(screen.getByRole('main').getAttribute('aria-busy')).toBeNull();
  });

  it('renders the brand name from the settings of the engine, excluded from translation', async () => {
    await renderApp();

    const brand = await screen.findByRole('heading', { name: BRAND_NAME });

    expect(brand.getAttribute('translate')).toBe('no');
    expect(screen.queryByRole('heading', { name: defaultTenant.brandName })).toBeNull();
  });

  it('renders the placeholder from the locale catalog', async () => {
    await renderApp();

    expect(await screen.findByText(defaultLocaleCatalog['field.placeholder'])).toBeDefined();
  });

  it('applies the term override from the settings of the engine without code changes', async () => {
    await renderApp({ placeholder: OVERRIDDEN_PLACEHOLDER });

    expect(await screen.findByText(OVERRIDDEN_PLACEHOLDER)).toBeDefined();
    expect(screen.queryByText(defaultLocaleCatalog['field.placeholder'])).toBeNull();
  });

  it('sets the document language and title from the settings of the engine', async () => {
    await renderApp();

    await screen.findByRole('heading', { name: BRAND_NAME });

    expect(document.documentElement.lang).toBe(defaultTenant.defaultLocale);
    expect(document.title).toBe(BRAND_NAME);
  });
});
