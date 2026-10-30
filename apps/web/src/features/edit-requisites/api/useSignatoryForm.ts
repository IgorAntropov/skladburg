import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';

import { SaveSignatoryRequestFormRules } from '@skladburg/contracts/forms/organization/v1/requisites';
import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import { useQueryClient } from '@tanstack/react-query';

import type {
  CommandFormValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';
import { useAnnounce } from '@/shared/ui';

import type { RequisitesTranslate } from '../i18n/requisitesSection';
import type {
  SignatoryFormValues,
  SignatoryUpdateValue,
} from '../model/signatoryFormValues';

import { translateRequisitesViolation } from '../lib/translateRequisitesViolation';
import { toSignatoryInput } from '../model/signatoryFormValues';
import { readSavedRequisites } from './readSavedRequisites';
import { useRequisitesQueryKey } from './useRequisitesQueryKey';

const WATCHED_FIELDS: readonly FormFieldPathValue<SignatoryFormValues>[] = ['signatory.basis'];

export interface UseSignatoryFormOptions {
  defaultValues: SignatoryFormValues;
  id: string;
  isDefault: boolean;
  onSaved: (requisites: OrganizationRequisites) => void;
  signatoriesVersion: bigint;
  t: RequisitesTranslate;
}

export const useSignatoryForm = ({
  defaultValues,
  id,
  isDefault,
  onSaved,
  signatoriesVersion,
  t,
}: UseSignatoryFormOptions): CommandFormValue<SignatoryFormValues> => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = useRequisitesQueryKey();
  const announce = useAnnounce();

  const execute = async (values: SignatoryUpdateValue, idempotencyKey: string): Promise<OrganizationRequisites> => {
    const response = await client.service(OrganizationRequisitesService).saveSignatory({
      expectedVersion: signatoriesVersion,
      idempotencyKey,
      signatory: toSignatoryInput(values, id, isDefault),
    });

    return readSavedRequisites(response);
  };

  const handleSaved = (saved: OrganizationRequisites): void => {
    console.log('> useSignatoryForm -> handleSaved:', { version: String(saved.version) });
    queryClient.setQueryData(queryKey, saved);
    announce(t('requisites.signatories.saved'));
    onSaved(saved);
  };

  const translateViolation = (ruleId: string): string | undefined => translateRequisitesViolation(t, ruleId);

  return useCommandForm<SignatoryFormValues, OrganizationRequisites, SignatoryUpdateValue>({
    defaultValues,
    execute,
    method: OrganizationRequisitesService.method.saveSignatory,
    onSuccess: handleSaved,
    rules: SaveSignatoryRequestFormRules,
    translateViolation,
    watchedFields: WATCHED_FIELDS,
  });
};
