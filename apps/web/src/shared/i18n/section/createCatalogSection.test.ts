import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createProbeSection,
  enSectionCatalog,
  ruSectionCatalog,
} from './testing/sectionFixtures';

describe('createCatalogSection', () => {
  it('starts in the loading state for every locale', () => {
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });

    expect(section.read('ru')).toEqual({ catalog: undefined, status: 'loading' });
    expect(section.read('en')).toEqual({ catalog: undefined, status: 'loading' });
  });

  it('loads the catalog of the requested locale only', async () => {
    const loadRu = vi.fn(() => Promise.resolve(ruSectionCatalog));
    const loadEn = vi.fn(() => Promise.resolve(enSectionCatalog));
    const section = createProbeSection({ en: loadEn, ru: loadRu });

    await expect(section.load('en')).resolves.toBe(enSectionCatalog);

    expect(loadEn).toHaveBeenCalledTimes(1);
    expect(loadRu).not.toHaveBeenCalled();
    expect(section.read('en')).toEqual({ catalog: enSectionCatalog, status: 'ready' });
    expect(section.read('ru').status).toBe('loading');
  });

  it('caches the module for the section and the locale', async () => {
    const loadRu = vi.fn(() => Promise.resolve(ruSectionCatalog));
    const section = createProbeSection({ ru: loadRu });

    const [first, second] = await Promise.all([section.load('ru'), section.load('ru')]);
    const third = await section.load('ru');

    expect(first).toBe(second);
    expect(third).toBe(first);
    expect(loadRu).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded state object stable between reads', async () => {
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });
    await section.load('ru');

    expect(section.read('ru')).toBe(section.read('ru'));
  });

  it('notifies subscribers when loading starts and when it finishes', async () => {
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });
    const listener = vi.fn();
    section.subscribe(listener);

    const loading = section.load('ru');

    expect(listener).toHaveBeenCalledTimes(1);

    await loading;

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', async () => {
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });
    const listener = vi.fn();
    const unsubscribe = section.subscribe(listener);
    unsubscribe();

    await section.load('ru');

    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects for a locale without a loader and reports the error state', async () => {
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });

    await expect(section.load('en')).rejects.toThrow('en');

    expect(section.read('en')).toEqual({ catalog: undefined, status: 'error' });
  });

  it('does not resolve inherited loader names as locales', async () => {
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });

    await expect(section.load('toString')).rejects.toThrow('toString');
  });

  it('reports the error state and loads again on the next request', async () => {
    const loadRu = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(ruSectionCatalog);
    const section = createProbeSection({ ru: loadRu });

    await expect(section.load('ru')).rejects.toThrow('network');

    expect(section.read('ru')).toEqual({ catalog: undefined, status: 'error' });

    await expect(section.load('ru')).resolves.toBe(ruSectionCatalog);

    expect(loadRu).toHaveBeenCalledTimes(2);
    expect(section.read('ru').status).toBe('ready');
  });

  it('swallows the failure of a fire-and-forget request', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const section = createProbeSection({ ru: () => Promise.reject(new Error('network')) });

    section.request('ru');
    await vi.waitFor(() => {
      expect(section.read('ru').status).toBe('error');
    });

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('lists the locales it can load', () => {
    const section = createProbeSection({
      en: () => Promise.resolve(enSectionCatalog),
      ru: () => Promise.resolve(ruSectionCatalog),
    });

    expect(section.locales.toSorted()).toEqual(['en', 'ru']);
    expect(section.prefix).toBe('probe');
  });
});
