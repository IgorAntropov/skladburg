import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

import type { CatalogShapeValue } from '../localizer/messageShape';
import type {
  CatalogSectionResultValue,
  CatalogSectionValue,
  SectionTranslate,
} from './sectionTypes';

import { useI18n } from '../react/useI18n';
import { createTranslate } from '../translation/createTranslator';

export const useCatalogSection = <TCatalog extends CatalogShapeValue>(
  section: CatalogSectionValue<TCatalog>,
): CatalogSectionResultValue<TCatalog> => {
  const snapshot = useI18n();
  const { locale } = snapshot;
  const state = useSyncExternalStore(section.subscribe, () => section.read(locale));
  const { catalog, status } = state;

  const t = useMemo((): SectionTranslate<TCatalog> | undefined => {
    return catalog === undefined ? undefined : createTranslate<TCatalog>(snapshot.createSectionTranslator(catalog));
  }, [catalog, snapshot]);

  const retry = useCallback((): void => {
    console.log('> useCatalogSection -> retry:', { locale, prefix: section.prefix });
    section.request(locale);
  }, [locale, section]);

  useEffect(() => {
    section.request(locale);
  }, [locale, section]);

  return { retry, status, t };
};
