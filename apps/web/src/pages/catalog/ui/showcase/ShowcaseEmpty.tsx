import type { ReactElement } from 'react';

import { SearchX } from 'lucide-react';

import { AssistantPortrait } from '@/entities/assistant';
import {
  Button,
  EmptyState,
} from '@/shared/ui';

import { useCatalogTexts } from '../../model/useCatalogTexts';

interface ShowcaseEmptyProps {
  isFiltered: boolean;
  onReset: () => void;
}

export const ShowcaseEmpty = ({ isFiltered, onReset }: ShowcaseEmptyProps): ReactElement => {
  const { t } = useCatalogTexts();

  const handleResetClick = (): void => {
    console.log('> ShowcaseEmpty -> handleResetClick:', {});
    onReset();
  };

  if (isFiltered) {
    return (
      <EmptyState
        action={<Button onClick={handleResetClick} variant="ghost">{t('catalog.filter.reset')}</Button>}
        className="py-8"
        data-testid="catalog-empty-filtered"
        hint={t('catalog.empty.filtered.hint')}
        icon={SearchX}
        text={t('catalog.empty.filtered.text')}
      />
    );
  }

  return (
    <EmptyState
      className="py-8"
      data-testid="catalog-empty-none"
      hint={t('catalog.empty.none.hint')}
      media={<AssistantPortrait size="sm" />}
      text={t('catalog.empty.none.text')}
    />
  );
};
