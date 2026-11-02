import type { ReactElement } from 'react';

import { AssistantPortrait } from '@/entities/assistant';
import { EmptyState } from '@/shared/ui';

import type { CatalogEmptyReasonValue } from '../lib/resolveCatalogAccess';

import { useCatalogTexts } from '../model/useCatalogTexts';

interface CatalogEmptyProps {
  reason: CatalogEmptyReasonValue;
}

export const CatalogEmpty = ({ reason }: CatalogEmptyProps): ReactElement => {
  const { t } = useCatalogTexts();

  if (reason === 'no-customer-profile') {
    return (
      <EmptyState
        className="py-8"
        data-testid="catalog-empty-no-customer-profile"
        hint={t('catalog.empty.noCustomerProfile.hint')}
        media={<AssistantPortrait size="sm" />}
        text={t('catalog.empty.noCustomerProfile.text')}
      />
    );
  }

  return (
    <EmptyState
      className="py-8"
      data-testid="catalog-empty-no-tabs"
      hint={t('catalog.empty.noTabs.hint')}
      media={<AssistantPortrait size="sm" />}
      text={t('catalog.empty.noTabs.text')}
    />
  );
};
