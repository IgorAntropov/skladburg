import type { ReactElement } from 'react';

import { useSalesTermsQuery } from '@/entities/listing';
import { WidgetStates } from '@/shared/ui';

import { SALES_TERMS_EDIT_FOCUS_KEY } from '../../model/editFocusKeys';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditLauncher } from '../../model/useEditLauncher';
import { loadSalesTermsForm } from '../loadSalesTermsForm';
import { SalesTermsCardSkeleton } from '../skeleton/SalesTermsCardSkeleton';
import { SalesTermsSummary } from './SalesTermsSummary';

export const SalesTermsCard = (): ReactElement => {
  const { t } = useCatalogTexts();
  const termsQuery = useSalesTermsQuery();
  const launcher = useEditLauncher(loadSalesTermsForm, SALES_TERMS_EDIT_FOCUS_KEY);

  const SalesTermsForm = launcher.module?.SalesTermsForm;

  const handleRetry = (): void => {
    console.log('> SalesTermsCard -> handleRetry:', {});
    void termsQuery.refetch();
  };

  return (
    <WidgetStates
      data={termsQuery.data}
      error={termsQuery.error}
      isRetrying={termsQuery.isFetching}
      loadingLabel={t('catalog.terms.loading')}
      onRetry={handleRetry}
      skeleton={<SalesTermsCardSkeleton />}
    >
      {terms => (SalesTermsForm === undefined
        ? <SalesTermsSummary launcher={launcher} terms={terms} />
        : <SalesTermsForm onClose={launcher.close} terms={terms} />)}
    </WidgetStates>
  );
};
