import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import { useTenantSettings } from '@/shared/tenant';

export const useDocumentSync = (): void => {
  const { locale } = useI18n();
  const { brandName } = useTenantSettings();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = brandName;
  }, [locale, brandName]);
};
