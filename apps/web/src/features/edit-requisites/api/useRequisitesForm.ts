import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';

import { runFieldCheck } from '@skladburg/contracts/forms';
import { UpdateOrganizationRequisitesRequestFormRules } from '@skladburg/contracts/forms/organization/v1/requisites';
import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import { useQueryClient } from '@tanstack/react-query';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';
import { useAnnounce } from '@/shared/ui';

import type { RequisitesTranslate } from '../i18n/requisitesSection';
import type {
  RequisitesFormValues,
  RequisitesUpdateValue,
} from '../model/requisitesFormValues';

import { translateRequisitesViolation } from '../lib/translateRequisitesViolation';
import { toRequisitesFormValues } from '../model/requisitesFormValues';
import { useRequisitesQueryKey } from './useRequisitesQueryKey';

export interface UseRequisitesFormOptions {
  onSaved: (requisites: OrganizationRequisites) => void;
  requisites: OrganizationRequisites;
  t: RequisitesTranslate;
}

export const useRequisitesForm = ({
  onSaved,
  requisites,
  t,
}: UseRequisitesFormOptions): CommandFormValue<RequisitesFormValues> => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = useRequisitesQueryKey();
  const announce = useAnnounce();

  const execute = async (values: RequisitesUpdateValue, idempotencyKey: string): Promise<OrganizationRequisites> => {
    const response = await client.service(OrganizationRequisitesService).updateOrganizationRequisites({
      bank: values.bank,
      expectedVersion: requisites.version,
      idempotencyKey,
      legalAddress: values.legalAddress,
      vatMode: values.vatMode,
    });

    if (response.requisites === undefined) {
      throw new TypeError('The server did not return the saved requisites');
    }

    return response.requisites;
  };

  const handleSaved = (saved: OrganizationRequisites): void => {
    console.log('> useRequisitesForm -> handleSaved:', { version: String(saved.version) });
    queryClient.setQueryData(queryKey, saved);
    announce(t('requisites.saved'));
    onSaved(saved);
  };

  const translateViolation = (ruleId: string): string | undefined => translateRequisitesViolation(t, ruleId);

  return useCommandForm<RequisitesFormValues, OrganizationRequisites, RequisitesUpdateValue>({
    defaultValues: toRequisitesFormValues(requisites),
    execute,
    method: OrganizationRequisitesService.method.updateOrganizationRequisites,
    onSuccess: handleSaved,
    rules: UpdateOrganizationRequisitesRequestFormRules,
    runCheck: runFieldCheck,
    translateViolation,
  });
};
