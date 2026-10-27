import type {
  CatalogShapeValue,
  LocaleCode,
} from '../localizer/messageShape';
import type {
  CatalogSectionOptionsValue,
  CatalogSectionValue,
  SectionLocaleCatalogValue,
  SectionStateValue,
} from './sectionTypes';

const LOADING_STATE = { catalog: undefined, status: 'loading' } as const;

const ERROR_STATE = { catalog: undefined, status: 'error' } as const;

export const createCatalogSection = <TCatalog extends CatalogShapeValue>({
  loaders,
  prefix,
}: CatalogSectionOptionsValue<TCatalog>): CatalogSectionValue<TCatalog> => {
  const listeners = new Set<() => void>();
  const requests = new Map<LocaleCode, Promise<SectionLocaleCatalogValue<TCatalog>>>();
  const states = new Map<LocaleCode, SectionStateValue<TCatalog>>();

  const commit = (locale: LocaleCode, state: SectionStateValue<TCatalog>): void => {
    states.set(locale, state);

    for (const listener of [...listeners]) {
      listener();
    }
  };

  const load = (locale: LocaleCode): Promise<SectionLocaleCatalogValue<TCatalog>> => {
    const cached = requests.get(locale);

    if (cached !== undefined) {
      return cached;
    }

    const loader = Object.hasOwn(loaders, locale) ? loaders[locale] : undefined;
    const source = loader === undefined
      ? Promise.reject(new Error(`Catalog section "${prefix}" has no loader for locale "${locale}"`))
      : loader();

    const request = source.then(
      (catalog): SectionLocaleCatalogValue<TCatalog> => {
        commit(locale, { catalog, status: 'ready' });

        return catalog;
      },
      (error: unknown): never => {
        requests.delete(locale);
        commit(locale, ERROR_STATE);
        throw error;
      },
    );

    requests.set(locale, request);
    commit(locale, LOADING_STATE);

    return request;
  };

  return {
    load,
    locales: Object.keys(loaders),
    prefix,
    read: locale => states.get(locale) ?? LOADING_STATE,
    request: (locale) => {
      load(locale).catch((error: unknown) => {
        console.log('> createCatalogSection -> request:', { error, locale, prefix });
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return (): void => {
        listeners.delete(listener);
      };
    },
  };
};
