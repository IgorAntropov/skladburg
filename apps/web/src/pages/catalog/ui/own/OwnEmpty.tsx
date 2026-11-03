import type { ReactElement } from 'react';

import { AssistantPortrait } from '@/entities/assistant';
import { EmptyState } from '@/shared/ui';

import { useCatalogTexts } from '../../model/useCatalogTexts';

export const OwnEmpty = (): ReactElement => {
  const { t } = useCatalogTexts();

  return (
    <EmptyState
      className="py-8"
      data-testid="catalog-empty-own-none"
      hint={t('catalog.empty.ownNone.hint')}
      media={<AssistantPortrait size="sm" />}
      text={t('catalog.empty.ownNone.text')}
    />
  );
};
