import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';

import {
  useCallback,
  useMemo,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';
import {
  useAddress,
  useNavigate,
} from '@/shared/routing';
import {
  SceneCameraControls,
  ScenePlaceholder,
  SceneViewport,
} from '@/widgets/scene-viewport';

import type { WarehouseSceneInteractionValue } from '../model/warehouseSceneInteraction';

import { warehouseSceneMessages } from '../i18n/warehouseSceneRu';
import { projectWarehouseCargo } from '../model/projectWarehouseCargo';

const loadWarehouseScene = createCachedModuleLoader(() => import('../scene/WarehouseWorldScene'));

interface WarehouseWorkspaceSceneProps extends Omit<WarehouseSceneInteractionValue, 'cargo' | 'focusRequest' | 'onCellSelect'> {
  isLoading: boolean;
  label: string;
  preferredTaskId: string | undefined;
  tasks: readonly ReceivingTask[] | undefined;
  topology: null | undefined | WarehouseTopology;
}

const WarehouseWorkspaceScene = ({
  balances, isLoading, label, preferredTaskId, scannedCell, selectedCellId, tasks, topology,
}: WarehouseWorkspaceSceneProps): ReactElement => {
  const { createSectionTranslator, t } = useI18n();
  const navigate = useNavigate();
  const { focusRequest } = useAddress();
  const areaId = topology?.receivingArea?.id;
  const hasDock = topology?.receivingArea?.unloadingPoint?.position !== undefined;
  const cargo = useMemo(
    () => tasks === undefined ? undefined : projectWarehouseCargo(tasks, areaId, hasDock, preferredTaskId),
    [areaId, hasDock, preferredTaskId, tasks],
  );

  const handleCellSelect = useCallback((id: string): void => {
    navigate({ kind: 'object', object: { id, type: 'cell' } });
  }, [navigate]);

  if (topology === null || topology === undefined) {
    return isLoading
      ? <ScenePlaceholder isLoading label={t('routing.section.loading')} />
      : <ScenePlaceholder label={createSectionTranslator(warehouseSceneMessages)('warehouseScene.empty')} />;
  }

  return (
    <SceneViewport
      interaction={{ balances, cargo, focusRequest, onCellSelect: handleCellSelect, scannedCell, selectedCellId }}
      label={label}
      loadScene={loadWarehouseScene}
      sceneData={topology}
    />
  );
};

export const WarehouseSceneControls = SceneCameraControls;

export default WarehouseWorkspaceScene;
