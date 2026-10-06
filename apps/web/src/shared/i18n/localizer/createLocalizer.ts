import type {
  ILocalizer,
  LocaleCatalogValue,
  LocalizerOptionsValue,
  TenantLocalizationValue,
} from './localizationTypes';
import type { LocaleCode } from './messageShape';

import { createSnapshot } from '../translation/createSnapshot';
import { resolveLocale } from './resolveLocale';

interface LocalizationRequestValue {
  requestedLocale: LocaleCode | undefined;
  tenant: TenantLocalizationValue;
}

export const createLocalizer = async ({
  bundledLocales,
  catalogLoaders,
  requestedLocale,
  tenant,
}: LocalizerOptionsValue): Promise<ILocalizer> => {
  const catalogs = new Map<LocaleCode, Promise<LocaleCatalogValue>>();
  const listeners = new Set<() => void>();

  const loadCatalog = (locale: LocaleCode): Promise<LocaleCatalogValue> => {
    const cached = catalogs.get(locale);

    if (cached !== undefined) {
      return cached;
    }

    const loader = Object.hasOwn(catalogLoaders, locale) ? catalogLoaders[locale] : undefined;

    if (loader === undefined) {
      return Promise.reject(new Error(`Catalog loader is missing for locale "${locale}"`));
    }

    const loading = loader().catch((error: unknown): never => {
      catalogs.delete(locale);
      throw error;
    });
    catalogs.set(locale, loading);

    return loading;
  };

  const initialLocale = resolveLocale({ bundledLocales, requestedLocale, tenant });
  let snapshot = createSnapshot(initialLocale, await loadCatalog(initialLocale), tenant);
  let committed: LocalizationRequestValue = { requestedLocale, tenant };
  let desired: LocalizationRequestValue = committed;
  let latestRequestId = 0;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const commit = async (request: LocalizationRequestValue): Promise<void> => {
    latestRequestId += 1;
    const requestId = latestRequestId;
    desired = request;

    const locale = resolveLocale({ bundledLocales, ...request });
    let catalog: LocaleCatalogValue;

    try {
      catalog = await loadCatalog(locale);
    }
    catch (error) {
      if (requestId === latestRequestId) {
        desired = committed;
      }
      throw error;
    }

    if (requestId !== latestRequestId) {
      return;
    }

    const isUnchanged = locale === snapshot.locale && request.tenant === committed.tenant;
    committed = request;

    if (isUnchanged) {
      return;
    }

    snapshot = createSnapshot(locale, catalog, request.tenant);
    notify();
  };

  return {
    applyTenant: nextTenant => commit({ requestedLocale: desired.requestedLocale, tenant: nextTenant }),
    getSnapshot: () => snapshot,
    setLocale: async (locale) => {
      const isAllowed = bundledLocales.includes(locale) && desired.tenant.availableLocales.includes(locale);

      if (!isAllowed) {
        return;
      }

      await commit({ requestedLocale: locale, tenant: desired.tenant });
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return (): void => {
        listeners.delete(listener);
      };
    },
  };
};
