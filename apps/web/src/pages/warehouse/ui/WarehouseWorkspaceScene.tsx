import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  useCallback,
  useEffect,
  useMemo,
} from 'react';

import { useCan } from '@/entities/session';
import { useTrips } from '@/entities/transport';
import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  useAddress,
  useNavigate,
} from '@/shared/routing';
import {
  SceneCameraControls,
  ScenePlaceholder,
  SceneViewport,
} from '@/widgets/scene-viewport';

import type {
  WarehouseConstructionLayerProps,
  WarehouseSceneInteractionValue,
} from '../model/warehouseSceneInteraction';

import { warehouseSceneMessages } from '../i18n/warehouseSceneRu';
import { projectWarehouseCargo } from '../model/projectWarehouseCargo';

const loadWarehouseScene = createCachedModuleLoader(() => import('../scene/WarehouseWorldScene'));
const loadWarehouseConstruction = createCachedModuleLoader(() => import('../scene/WarehouseConstruction'));

interface WarehouseWorkspaceSceneProps extends Omit<
  WarehouseSceneInteractionValue, 'cargo' | 'constructionLayer' | 'focusRequest' | 'onCellSelect'
> {
  isLoading: boolean;
  label: string;
  picking: readonly PickingTask[] | undefined;
  tasks: readonly ReceivingTask[] | undefined;
  topology: null | undefined | WarehouseTopology;
  warehouseId: string;
}

const WarehouseConstructionLayer = (props: WarehouseConstructionLayerProps): null | ReactElement => {
  const { load, state } = useChunkLoader(loadWarehouseConstruction);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind !== 'loaded') {
    return null;
  }

  const Construction = state.module.default;
  return <Construction {...props} />;
};

const WarehouseWorkspaceScene = ({
  balances, construction, isLoading, label, picking, scannedCell, selectedCellId, tasks, topology, warehouseId,
}: WarehouseWorkspaceSceneProps): ReactElement => {
  const { createSectionTranslator, t } = useI18n();
  const navigate = useNavigate();
  const { focusRequest } = useAddress();
  const canViewTrips = useCan(PermissionCode.TRIP_VIEW, { kind: 'organization' });
  const areaId = topology?.receivingArea?.id;
  const hasDock = topology?.receivingArea?.unloadingPoint?.position !== undefined;
  const canLoadTrips = canViewTrips && hasDock;
  const tripQuery = useTrips(canLoadTrips);
  const isAwaitingTrips = canLoadTrips && tripQuery.isPending;
  const trips = canLoadTrips && !isReadAccessDenied(tripQuery.error) ? tripQuery.data : undefined;
  const cargo = useMemo(
    () => isAwaitingTrips || (tasks === undefined && picking === undefined)
      ? undefined
      : projectWarehouseCargo(tasks ?? [], areaId, hasDock, { picking, trips, warehouseId }),
    [areaId, hasDock, isAwaitingTrips, picking, tasks, trips, warehouseId],
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
      interaction={{
        balances,
        cargo,
        construction,
        constructionLayer: WarehouseConstructionLayer,
        focusRequest,
        onCellSelect: handleCellSelect,
        scannedCell,
        selectedCellId,
      }}
      label={label}
      loadScene={loadWarehouseScene}
      sceneData={topology}
    />
  );
};

export const WarehouseSceneControls = SceneCameraControls;

export default WarehouseWorkspaceScene;
