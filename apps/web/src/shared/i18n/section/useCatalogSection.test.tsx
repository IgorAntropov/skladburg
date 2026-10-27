import type { ReactNode } from 'react';

import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ILocalizer } from '../localizer/localizationTypes';
import type { TermOverridesValue } from '../localizer/localizationTypes';

import { createLocalizer } from '../localizer/createLocalizer';
import { LocalizerProvider } from '../react/LocalizerProvider';
import {
  createProbeSection,
  enSectionCatalog,
  ruSectionCatalog,
} from './testing/sectionFixtures';
import { useCatalogSection } from './useCatalogSection';

const createLocalizerWith = (termOverrides: TermOverridesValue = {}): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru', 'en'],
  catalogLoaders: {
    en: () => Promise.resolve(defaultLocaleCatalog),
    ru: () => Promise.resolve(defaultLocaleCatalog),
  },
  requestedLocale: 'ru',
  tenant: { availableLocales: ['ru', 'en'], defaultLocale: 'ru', termOverrides },
  userTimeZone: 'UTC',
});

const renderSection = (
  localizer: ILocalizer,
  section: ReturnType<typeof createProbeSection>,
): ReturnType<typeof renderHook<ReturnType<typeof useCatalogSection<typeof ruSectionCatalog>>, unknown>> => {
  return renderHook(() => useCatalogSection(section), {
    wrapper: ({ children }: { children: ReactNode }) => <LocalizerProvider localizer={localizer}>{children}</LocalizerProvider>,
  });
};

describe('useCatalogSection', () => {
  it('shows loading first and then translates with the catalog of the snapshot locale', async () => {
    const localizer = await createLocalizerWith();
    const section = createProbeSection({
      en: () => Promise.resolve(enSectionCatalog),
      ru: () => Promise.resolve(ruSectionCatalog),
    });

    const { result } = renderSection(localizer, section);

    expect(result.current.status).toBe('loading');
    expect(result.current.t).toBeUndefined();

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.t?.('probe.title')).toBe('Заголовок');
    expect(result.current.t?.('probe.greeting', { name: 'Анна' })).toBe('Здравствуйте, Анна');
  });

  it('reloads the section when the language changes', async () => {
    const localizer = await createLocalizerWith();
    const loadRu = vi.fn(() => Promise.resolve(ruSectionCatalog));
    const loadEn = vi.fn(() => Promise.resolve(enSectionCatalog));
    const section = createProbeSection({ en: loadEn, ru: loadRu });
    const { result } = renderSection(localizer, section);
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await act(async () => {
      await localizer.setLocale('en');
    });
    await waitFor(() => {
      expect(result.current.t?.('probe.title')).toBe('Title');
    });

    expect(loadEn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await localizer.setLocale('ru');
    });
    await waitFor(() => {
      expect(result.current.t?.('probe.title')).toBe('Заголовок');
    });

    expect(loadRu).toHaveBeenCalledTimes(1);
    expect(loadEn).toHaveBeenCalledTimes(1);
  });

  it('applies the organization override by the full key', async () => {
    const localizer = await createLocalizerWith({ ru: { 'probe.title': 'Иное название', 'probe.unknown': 'Лишнее' } });
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });
    const { result } = renderSection(localizer, section);

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.t?.('probe.title')).toBe('Иное название');
    expect(result.current.t?.('probe.greeting', { name: 'Анна' })).toBe('Здравствуйте, Анна');
  });

  it('ignores an override with other placeholders', async () => {
    const localizer = await createLocalizerWith({ ru: { 'probe.greeting': 'Здравствуйте, {user}' } });
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });
    const { result } = renderSection(localizer, section);

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.t?.('probe.greeting', { name: 'Анна' })).toBe('Здравствуйте, Анна');
  });

  it.each([
    [1, '1 штука'],
    [2, '2 штуки'],
    [5, '5 штук'],
    [21, '21 штука'],
  ])('pluralizes %s', async (count, expected) => {
    const localizer = await createLocalizerWith();
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });
    const { result } = renderSection(localizer, section);

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.t?.('probe.count', { count })).toBe(expected);
  });

  it('pluralizes an organization override of a plural message', async () => {
    const localizer = await createLocalizerWith({
      ru: { 'probe.count': { few: '{count} места', many: '{count} мест', one: '{count} место', other: '{count} места' } },
    });
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });
    const { result } = renderSection(localizer, section);

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.t?.('probe.count', { count: 3 })).toBe('3 места');
    expect(result.current.t?.('probe.count', { count: 7 })).toBe('7 мест');
  });

  it('applies a changed tenant without reloading the module', async () => {
    const localizer = await createLocalizerWith();
    const loadRu = vi.fn(() => Promise.resolve(ruSectionCatalog));
    const section = createProbeSection({ ru: loadRu });
    const { result } = renderSection(localizer, section);
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await act(async () => {
      await localizer.applyTenant({
        availableLocales: ['ru', 'en'],
        defaultLocale: 'ru',
        termOverrides: { ru: { 'probe.title': 'Новое имя' } },
      });
    });

    expect(result.current.t?.('probe.title')).toBe('Новое имя');
    expect(loadRu).toHaveBeenCalledTimes(1);
  });

  it('reports an error and retries on request', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const localizer = await createLocalizerWith();
    const loadRu = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(ruSectionCatalog);
    const section = createProbeSection({ ru: loadRu });
    const { result } = renderSection(localizer, section);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.t).toBeUndefined();

    act(() => {
      result.current.retry();
    });

    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.t?.('probe.title')).toBe('Заголовок');
    expect(loadRu).toHaveBeenCalledTimes(2);
    logSpy.mockRestore();
  });

  it('is ready at once and does not load again on a repeated mount', async () => {
    const localizer = await createLocalizerWith();
    const loadRu = vi.fn(() => Promise.resolve(ruSectionCatalog));
    const section = createProbeSection({ ru: loadRu });
    const first = renderSection(localizer, section);
    await waitFor(() => {
      expect(first.result.current.status).toBe('ready');
    });
    first.unmount();

    const second = renderSection(localizer, section);

    expect(second.result.current.status).toBe('ready');
    expect(second.result.current.t?.('probe.title')).toBe('Заголовок');
    expect(loadRu).toHaveBeenCalledTimes(1);
  });

  it('shares one load between components using the same section', async () => {
    const localizer = await createLocalizerWith();
    const loadRu = vi.fn(() => Promise.resolve(ruSectionCatalog));
    const section = createProbeSection({ ru: loadRu });
    const first = renderSection(localizer, section);
    const second = renderSection(localizer, section);

    await waitFor(() => {
      expect(first.result.current.status).toBe('ready');
      expect(second.result.current.status).toBe('ready');
    });

    expect(loadRu).toHaveBeenCalledTimes(1);
  });
});
