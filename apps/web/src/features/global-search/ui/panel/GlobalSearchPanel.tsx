import type { ReactElement } from 'react';

import { useCatalogSection } from '@/shared/i18n';

import type { SearchPanelProps } from '../../model/searchPanelTypes';

import { globalSearchSection } from '../../i18n/globalSearchSection';
import { SearchPanelLoadNotice } from '../SearchPanelLoadNotice';
import { GlobalSearchPanelContent } from './GlobalSearchPanelContent';

export const GlobalSearchPanel = (props: SearchPanelProps): ReactElement => {
  const { retry, status, t } = useCatalogSection(globalSearchSection);

  if (t === undefined) {
    return (
      <>
        <div hidden id={props.listboxId} role="listbox" />
        {status === 'error' && <SearchPanelLoadNotice isRepeated={false} onRetry={retry} />}
      </>
    );
  }

  return <GlobalSearchPanelContent {...props} t={t} />;
};
