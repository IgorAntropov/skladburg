import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { TabsItemValue } from '@/shared/ui';

import { useI18n } from '@/shared/i18n';
import { Tabs } from '@/shared/ui';

import { hasListTabs } from '../lib/hasLists';

interface ListsZoneContentProps {
  defaultTabId?: string | undefined;
  header: ReactNode;
  tabs: readonly TabsItemValue[] | undefined;
}

const ROOT_CLASS_NAME = 'flex min-h-0 flex-1 flex-col gap-3';

const HEADER_CLASS_NAME = 'px-3 empty:hidden';

const TABS_CLASS_NAME = '[&>[role=tabpanel]]:scroll-shadow-y';

export const ListsZoneContent = ({ defaultTabId, header, tabs }: ListsZoneContentProps): ReactElement => {
  const { t } = useI18n();

  const isTabsShown = hasListTabs(tabs);

  return (
    <div className={ROOT_CLASS_NAME}>
      <div className={HEADER_CLASS_NAME}>{header}</div>
      {isTabsShown && <Tabs className={TABS_CLASS_NAME} defaultTabId={defaultTabId} items={tabs} label={t('hud.lists.label')} />}
    </div>
  );
};
