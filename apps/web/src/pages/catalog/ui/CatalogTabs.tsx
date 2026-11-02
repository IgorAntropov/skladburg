import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { Tabs } from '@/shared/ui';

import type { CatalogAccessValue } from '../lib/resolveCatalogAccess';

import { useCatalogTexts } from '../model/useCatalogTexts';
import { CatalogEmpty } from './CatalogEmpty';
import { ShowcaseTab } from './showcase/ShowcaseTab';

interface CatalogTabsProps {
  access: CatalogAccessValue;
  focus: ObjectRefValue | undefined;
}

export const CatalogTabs = ({ access, focus }: CatalogTabsProps): ReactElement => {
  const { t } = useCatalogTexts();

  if (access.emptyReason !== undefined) {
    return <CatalogEmpty reason={access.emptyReason} />;
  }

  const items: readonly TabsItemValue[] = access.tabs.map(tabId => ({
    content: <ShowcaseTab focus={focus} isVerified={access.isShowcaseVerified} />,
    id: tabId,
    label: t('catalog.tabs.showcase'),
  }));

  return <Tabs items={items} label={t('catalog.tabs.label')} />;
};
