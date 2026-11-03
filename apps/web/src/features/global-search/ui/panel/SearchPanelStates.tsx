import type { ReactElement } from 'react';

import { AssistantPortrait } from '@/entities/assistant';
import { EmptyState } from '@/shared/ui';

import type { GlobalSearchTranslate } from '../../i18n/globalSearchSection';
import type { GlobalSearchStatusValue } from '../../model/searchResultTypes';

const HINT_CLASS_NAME = 'text-sm leading-5 text-on-panel-muted';

interface SearchPanelStatesProps {
  status: GlobalSearchStatusValue;
  t: GlobalSearchTranslate;
}

export const SearchPanelStates = ({ status, t }: SearchPanelStatesProps): ReactElement | undefined => {
  switch (status) {
    case 'empty':
      return (
        <EmptyState
          className="py-6"
          data-testid="global-search-empty"
          hint={t('globalSearch.empty.hint')}
          media={<AssistantPortrait size="sm" />}
          text={t('globalSearch.empty.title')}
        />
      );
    case 'idle':
      return (
        <div className="flex flex-col gap-2 px-4 py-4" data-testid="global-search-idle">
          <p className={HINT_CLASS_NAME}>{t('globalSearch.idle.hint')}</p>
          <p className={`${HINT_CLASS_NAME} [@media(hover:none)]:hidden`}>{t('globalSearch.idle.keys')}</p>
        </div>
      );
    case 'no-sources':
      return (
        <EmptyState
          className="py-6"
          data-testid="global-search-no-sources"
          hint={t('globalSearch.noSources.hint')}
          media={<AssistantPortrait size="sm" />}
          text={t('globalSearch.noSources.title')}
        />
      );
    case 'ready':
    case 'searching':
      return undefined;
    case 'too-short':
      return (
        <p className={`px-4 py-3 ${HINT_CLASS_NAME}`} data-testid="global-search-too-short">
          {t('globalSearch.tooShort')}
        </p>
      );
  }
};
