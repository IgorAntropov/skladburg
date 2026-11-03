import type { SalesTerms } from '@skladburg/contracts/catalog/v1/catalog';

import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { SaveSalesTermsRequestFormRules } from '@skladburg/contracts/forms/catalog/v1/catalog';

import type {
  CommandFormValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';
import { useAnnounce } from '@/shared/ui';

import type { CatalogEditorTranslate } from '../../i18n/editor/editorSection';
import type {
  SalesTermsFormOutputValue,
  SalesTermsFormValues,
} from '../../lib/salesTermsFormValues';

import {
  buildSaveSalesTermsCommand,
  collectSalesTermsIssues,
} from '../../lib/buildSaveSalesTermsCommand';
import { toSalesTermsFormValues } from '../../lib/salesTermsFormValues';
import { translateCatalogViolation } from '../../lib/translateCatalogViolation';

export interface UseSaveSalesTermsFormOptions {
  onSaved: (saved: SalesTerms) => void;
  t: CatalogEditorTranslate;
  terms: SalesTerms;
}

const WATCHED_FIELDS: readonly FormFieldPathValue<SalesTermsFormValues>[] = ['hasOwnDelivery'];

export const useSaveSalesTermsForm = ({
  onSaved,
  t,
  terms,
}: UseSaveSalesTermsFormOptions): CommandFormValue<SalesTermsFormValues> => {
  const client = useApiClient();
  const announce = useAnnounce();

  const execute = async (values: SalesTermsFormOutputValue, idempotencyKey: string): Promise<SalesTerms> => {
    const command = buildSaveSalesTermsCommand(values);
    const response = await client.service(CatalogService).saveSalesTerms({
      expectedVersion: terms.version,
      idempotencyKey,
      isAutoConfirmEnabled: command.isAutoConfirmEnabled,
      ownDelivery: command.ownDelivery,
      preparationWorkingDays: command.preparationWorkingDays,
    });

    if (response.terms === undefined) {
      throw new Error('SaveSalesTerms response has no terms');
    }

    return response.terms;
  };

  const handleSaved = (saved: SalesTerms): void => {
    console.log('> useSaveSalesTermsForm -> handleSaved:', { version: String(saved.version) });
    announce(t('catalogEditor.terms.saved'));
    onSaved(saved);
  };

  const translateViolation = (ruleId: string): string | undefined => translateCatalogViolation(t, ruleId);

  return useCommandForm<SalesTermsFormValues, SalesTerms, SalesTermsFormOutputValue>({
    defaultValues: toSalesTermsFormValues(terms),
    execute,
    method: CatalogService.method.saveSalesTerms,
    onSuccess: handleSaved,
    rules: SaveSalesTermsRequestFormRules,
    translateViolation,
    validateValues: collectSalesTermsIssues,
    watchedFields: WATCHED_FIELDS,
  });
};
