import type { ReactElement } from 'react';

import {
  ChartNoAxesColumn,
  Handshake,
  ListChecks,
  Truck,
  Warehouse,
} from 'lucide-react';

import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { useI18n } from '@/shared/i18n';
import {
  HudLayout,
  ScenePlaceholder,
  useInspectorFocus,
  ZoneEmptyState,
} from '@/widgets/hud-layout';
import { ObjectInspector } from '@/widgets/object-inspector';

interface NetworkPageProps {
  focus: ObjectRefValue | undefined;
}

export const NetworkPage = ({ focus }: NetworkPageProps): ReactElement => {
  const { t } = useI18n();
  const inspectorFocus = useInspectorFocus('network', focus);

  const listTabs: readonly TabsItemValue[] = [
    {
      content: <ZoneEmptyState icon={Handshake} text={t('hud.lists.empty.deals')} />,
      id: 'deals',
      label: t('hud.lists.deals'),
    },
    {
      content: <ZoneEmptyState icon={Truck} text={t('hud.lists.empty.trips')} />,
      id: 'trips',
      label: t('hud.lists.trips'),
    },
    {
      content: <ZoneEmptyState icon={Warehouse} text={t('hud.lists.empty.warehouses')} />,
      id: 'warehouses',
      label: t('hud.lists.warehouses'),
    },
  ];

  return (
    <>
      <h1 className="sr-only">{t('section.network.title')}</h1>
      <HudLayout
        {...inspectorFocus}
        inspector={<ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} />}
        kpi={<ZoneEmptyState icon={ChartNoAxesColumn} text={t('hud.kpi.empty')} />}
        listTabs={listTabs}
        scene={<ScenePlaceholder label={t('section.network.placeholder')} />}
        tracker={<ZoneEmptyState icon={ListChecks} text={t('hud.tracker.empty')} />}
      />
    </>
  );
};
