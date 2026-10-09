import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { useI18n } from '@/shared/i18n';
import {
  HudLayout,
  ScenePlaceholder,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { ObjectInspector } from '@/widgets/object-inspector';

import { useWarehousesQuery } from '../api/useWarehousesQuery';
import { OrganizationCard } from './OrganizationCard';
import { WarehouseList } from './WarehouseList';

interface WarehousePageProps {
  focus: ObjectRefValue | undefined;
}

export const WarehousePage = ({ focus }: WarehousePageProps): ReactElement => {
  const { t } = useI18n();
  const inspectorFocus = useInspectorFocus('warehouse', focus);
  const { data: warehouses } = useWarehousesQuery();

  const listTabs: readonly TabsItemValue[] = [
    {
      content: <WarehouseList />,
      count: warehouses?.length,
      id: 'warehouses',
      label: t('hud.lists.warehouses'),
    },
  ];

  return (
    <>
      <h1 className="sr-only">{t('section.warehouse.title')}</h1>
      <HudLayout
        {...inspectorFocus}
        inspector={<ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} />}
        listsHeader={<OrganizationCard />}
        listTabs={listTabs}
        scene={<ScenePlaceholder label={t('warehouse.placeholder')} />}
      />
    </>
  );
};
