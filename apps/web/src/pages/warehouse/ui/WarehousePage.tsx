import type { ReactElement } from 'react';

import { useState } from 'react';

import type { ObjectRefValue } from '@/shared/routing';
import type { TabsItemValue } from '@/shared/ui';

import { useWarehousesQuery } from '@/entities/warehouse';
import {
  CreateWarehouseButton,
  CreateWarehousePanel,
  useCreateWarehouseLauncher,
} from '@/features/create-warehouse';
import { useI18n } from '@/shared/i18n';
import { useChunkLoader } from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
  useFocusHandoff,
} from '@/shared/ui';
import {
  HudLayout,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { ObjectInspector } from '@/widgets/object-inspector';
import { ScenePlaceholder } from '@/widgets/scene-viewport';

import { warehouseImportLauncherMessages } from '../i18n/warehouseImportLauncherRu';
import { loadWarehouseImportPanel } from './loadWarehouseImportPanel';
import { OrganizationCard } from './OrganizationCard';
import { WarehouseList } from './WarehouseList';

interface WarehousePageProps {
  focus: ObjectRefValue | undefined;
}

export const WarehousePage = ({ focus }: WarehousePageProps): ReactElement => {
  const { createSectionTranslator, t } = useI18n();
  const inspectorFocus = useInspectorFocus('warehouse', focus);
  const { data: warehouses } = useWarehousesQuery();
  const launcher = useCreateWarehouseLauncher();
  const { load, state } = useChunkLoader(loadWarehouseImportPanel);
  const { cancelFocus, ref: importButtonRef, requestFocus } = useFocusHandoff<HTMLButtonElement>('warehouse-import');
  const [isImportRequested, setIsImportRequested] = useState(false);

  const ImportPanel = isImportRequested && state.kind === 'loaded' ? state.module.WarehouseImportPanel : undefined;
  const isImportLoading = isImportRequested && (state.kind === 'loading' || state.kind === 'idle');
  const importRecovery = isImportRequested && state.kind === 'failed' ? state.recovery : undefined;
  const focusedWarehouseId = focus?.type === 'warehouse' ? focus.id : undefined;
  const canShowImport = ImportPanel === undefined && !launcher.isOpen && !launcher.isLoading;
  const canShowCreate = ImportPanel === undefined && !isImportLoading;
  const importLabel = createSectionTranslator(warehouseImportLauncherMessages)('warehouseImport.open');

  const handleImportOpen = (): void => {
    cancelFocus();
    setIsImportRequested(true);
    load();
  };

  const handleImportClose = (): void => {
    requestFocus();
    setIsImportRequested(false);
  };

  const panel = launcher.isOpen
    ? <CreateWarehousePanel launcher={launcher} />
    : ImportPanel === undefined
      ? undefined
      : <ImportPanel focusedWarehouseId={focusedWarehouseId} onClose={handleImportClose} />;

  const listTabs: readonly TabsItemValue[] = [
    {
      content: (
        <WarehouseList
          action={(
            <>
              {canShowCreate && <CreateWarehouseButton launcher={launcher} />}
              {canShowImport && (
                <Button
                  data-testid="warehouse-import-open"
                  onClick={handleImportOpen}
                  pending={isImportLoading}
                  pendingLabel={t('warehouse.create.opening')}
                  ref={importButtonRef}
                  variant="secondary"
                >
                  {importLabel}
                </Button>
              )}
              {canShowImport && importRecovery !== undefined && (
                <ChunkLoadNotice
                  message={t('routing.chunkError.message')}
                  onRetry={handleImportOpen}
                  recovery={importRecovery}
                  repeatedMessage={t('routing.chunkError.repeated')}
                />
              )}
            </>
          )}
        />
      ),
      count: warehouses?.length,
      id: 'warehouses',
      label: t('hud.lists.warehouses'),
    },
  ];

  return (
    <div className="contents" data-testid="page-warehouse">
      <h1 className="sr-only">{t('section.warehouse.title')}</h1>
      <HudLayout
        {...inspectorFocus}
        inspector={<ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} />}
        listsHeader={<OrganizationCard />}
        listTabs={listTabs}
        panel={panel}
        scene={<ScenePlaceholder label={t('warehouse.placeholder')} />}
      />
    </div>
  );
};
