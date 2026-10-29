import { AssistantAddressForm } from '@skladburg/contracts/organization/v1/organization';
import { useEffect } from 'react';

import type {
  SectionStatus,
  SectionTranslate,
} from '@/shared/i18n';

import { useOrganizationSettingsQuery } from '@/entities/organization';
import { useCatalogSection } from '@/shared/i18n';

import type { SupportCatalogValue } from '../i18n/supportSection';

import {
  supportInformalSection,
  supportSection,
} from '../i18n/supportSection';

export interface SupportTextsValue {
  retry: () => void;
  status: SectionStatus;
  t: SectionTranslate<SupportCatalogValue> | undefined;
}

export const useSupportTexts = (): SupportTextsValue => {
  const { data: settings, isError } = useOrganizationSettingsQuery();
  const isInformal = settings?.assistantAddressForm === AssistantAddressForm.INFORMAL;
  const { retry, status, t } = useCatalogSection(isInformal ? supportInformalSection : supportSection);

  const isAddressSettled = settings !== undefined || isError;

  useEffect(() => {
    if (status === 'error') {
      console.log('> useSupportTexts -> load:', { isInformal, status });
    }
  }, [isInformal, status]);

  return { retry, status: isAddressSettled ? status : 'loading', t: isAddressSettled ? t : undefined };
};
