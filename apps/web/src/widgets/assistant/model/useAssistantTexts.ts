import { useEffect } from 'react';

import { useOrganizationSettingsQuery } from '@/entities/organization';
import { useCatalogSection } from '@/shared/i18n';

import type { AssistantTranslate } from '../lib/formatReplicaText';

import {
  assistantInformalSection,
  assistantSection,
} from '../i18n/assistantSection';
import { resolveAddressForm } from '../lib/resolveAddressForm';

export interface AssistantTextsValue {
  isReady: boolean;
  t: AssistantTranslate | undefined;
}

export const useAssistantTexts = (): AssistantTextsValue => {
  const { data: settings, isError } = useOrganizationSettingsQuery();
  const addressForm = resolveAddressForm(settings?.assistantAddressForm);
  const { status, t } = useCatalogSection(addressForm === 'informal' ? assistantInformalSection : assistantSection);

  const isAddressSettled = settings !== undefined || isError;

  useEffect(() => {
    if (status === 'error') {
      console.log('> useAssistantTexts -> load:', { addressForm, status });
    }
  }, [addressForm, status]);

  return { isReady: isAddressSettled && t !== undefined, t };
};
