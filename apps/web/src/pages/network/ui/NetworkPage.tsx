import type { ReactElement } from 'react';

import {
  ChartNoAxesColumn,
  ListChecks,
} from 'lucide-react';
import {
  useCallback,
  useState,
} from 'react';

import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { AssistantPortrait } from '@/entities/assistant';
import { useI18n } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';
import {
  HudLayout,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { SceneCameraControls } from '@/widgets/scene-viewport';

import { useNetworkMapModel } from '../api/useNetworkMapModel';
import { EMPTY_NETWORK_MAP_MODEL } from '../model/emptyNetworkMapModel';
import { DEFAULT_ORGANIZATION_DIRECTORY_FILTER } from '../model/organizationDirectoryFilter';
import { useOrganizationDirectoryTable } from '../model/useOrganizationDirectoryTable';
import { NetworkCompaniesTab } from './NetworkCompaniesTab';
import { NetworkInspector } from './NetworkInspector';
import { NetworkSceneViewport } from './NetworkSceneViewport';
import { NetworkSitesTab } from './NetworkSitesTab';
import { OrganizationDirectoryPanelSlot } from './OrganizationDirectoryPanelSlot';

interface NetworkPageProps {
  focus: ObjectRefValue | undefined;
}

const SITES_TAB_ID = 'warehouses';

export const NetworkPage = ({ focus }: NetworkPageProps): ReactElement => {
  const { t } = useI18n();
  const inspectorFocus = useInspectorFocus('network', focus);
  const modelState = useNetworkMapModel();
  const [listTabsResetKey, setListTabsResetKey] = useState(0);
  const [directoryFilter, setDirectoryFilter] = useState(DEFAULT_ORGANIZATION_DIRECTORY_FILTER);
  const directoryTable = useOrganizationDirectoryTable();

  const handleWorldSiteSelect = useCallback((): void => {
    console.log('> NetworkPage -> handleWorldSiteSelect:');
    setListTabsResetKey(current => current + 1);
  }, []);

  const panel = directoryTable.isOpen
    ? (
        <OrganizationDirectoryPanelSlot
          filter={directoryFilter}
          focus={focus}
          onFilterChange={setDirectoryFilter}
          state={modelState}
          table={directoryTable}
        />
      )
    : undefined;

  const sceneData = modelState.data ?? (modelState.error === null ? undefined : EMPTY_NETWORK_MAP_MODEL);

  const listTabs: readonly TabsItemValue[] = [
    {
      content: <EmptyState media={<AssistantPortrait size="sm" />} text={t('hud.lists.empty.deals')} />,
      id: 'deals',
      label: t('hud.lists.deals'),
    },
    {
      content: <EmptyState media={<AssistantPortrait size="sm" />} text={t('hud.lists.empty.trips')} />,
      id: 'trips',
      label: t('hud.lists.trips'),
    },
    {
      content: <NetworkSitesTab focus={focus} state={modelState} />,
      count: modelState.data?.sites.length,
      id: SITES_TAB_ID,
      label: t('hud.lists.warehouses'),
    },
    {
      content: (
        <NetworkCompaniesTab
          filter={directoryFilter}
          focus={focus}
          onFilterChange={setDirectoryFilter}
          state={modelState}
          table={directoryTable}
        />
      ),
      id: 'companies',
      label: t('hud.lists.companies'),
    },
  ];

  return (
    <div className="contents" data-testid="page-network">
      <h1 className="sr-only">{t('section.network.title')}</h1>
      <HudLayout
        {...inspectorFocus}
        canCollapsePanels
        defaultListTabId={SITES_TAB_ID}
        inspector={<NetworkInspector focus={focus} onClose={inspectorFocus.onInspectorClose} state={modelState} />}
        kpi={<EmptyState icon={ChartNoAxesColumn} text={t('hud.kpi.empty')} />}
        listTabs={listTabs}
        listTabsResetKey={listTabsResetKey}
        panel={panel}
        scene={(
          <NetworkSceneViewport
            focus={focus}
            label={t('section.network.placeholder')}
            onWorldSiteSelect={handleWorldSiteSelect}
            sceneData={sceneData}
          />
        )}
        sceneControls={<SceneCameraControls />}
        tracker={<EmptyState icon={ListChecks} text={t('hud.tracker.empty')} />}
      />
    </div>
  );
};
