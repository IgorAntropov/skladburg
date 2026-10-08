import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import { useAddress } from '@/shared/routing';
import { useTenantSettings } from '@/shared/tenant';

import {
  getAddressSection,
  SECTION_TITLE_KEYS,
} from '../routing/sections';

export const useDocumentSync = (): void => {
  const { locale, t } = useI18n();
  const { brandName } = useTenantSettings();
  const { address } = useAddress();

  const section = address === undefined ? undefined : getAddressSection(address);
  const sectionTitle = address === undefined
    ? t('routing.notFound.title')
    : section === undefined ? undefined : t(SECTION_TITLE_KEYS[section]);
  const title = sectionTitle === undefined ? brandName : t('app.documentTitle', { brand: brandName, section: sectionTitle });

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.title = title;
  }, [title]);
};
