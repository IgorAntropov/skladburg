import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useCan } from '@/entities/session';
import { useTrips } from '@/entities/transport';
import {
  isReadAccessDenied,
  useActingContext,
} from '@/shared/api';
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
  useIsSceneCameraReady,
} from '@/widgets/scene-viewport';

import type { WarehouseWorkspaceValue } from '../api/useWarehouseWorkspace';
import type {
  WarehouseConstructionLayerProps,
  WarehouseSceneDataValue,
  WarehouseSceneInteractionValue,
} from '../model/warehouseSceneInteraction';
import type { WarehouseSceneParkingValue } from '../model/warehouseSceneParking';
import type { WarehouseYardFactsValue } from '../model/warehouseYardFacts';

import { useWarehouseYardLight } from '../api/useWarehouseYardLight';
import { useWarehouseYardRefresh } from '../api/useWarehouseYardRefresh';
import { warehouseWorkspaceKey } from '../api/warehouseWorkspaceKey';
import { warehouseSceneMessages } from '../i18n/warehouseSceneRu';
import { projectWarehouseCargo } from '../model/projectWarehouseCargo';
import { readWarehouseReceivingDocks } from '../model/warehouseReceivingDocks';
import { readWarehouseSceneParking } from '../model/warehouseSceneParking';
import { acceptWarehouseYardFacts } from '../model/warehouseYardFacts';

const loadWarehouseScene = createCachedModuleLoader(() => import('../scene/WarehouseWorldScene'));
const loadWarehouseConstruction = createCachedModuleLoader(() => import('../scene/WarehouseConstruction'));

interface WarehouseWorkspaceSceneProps extends Omit<
  WarehouseSceneInteractionValue,
  'cargo' | 'constructionLayer' | 'focusRequest' | 'isNight' | 'isRefreshingYardFacts' | 'onCellSelect' | 'parkingCapacity'
> {
  isLoading: boolean;
  label: string;
  picking: undefined | WarehouseWorkspaceValue['picking'];
  receiving: undefined | WarehouseWorkspaceValue['receiving'];
  timeZone: string;
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
  balances, construction, isLoading, label, picking, receiving, scannedCell, selectedCellId, timeZone, topology, warehouseId, yardDrag,
}: WarehouseWorkspaceSceneProps): ReactElement => {
  const { createSectionTranslator, t } = useI18n();
  const navigate = useNavigate();
  const { focusRequest } = useAddress();
  const { organizationId, userId } = useActingContext();
  const canViewTrips = useCan(PermissionCode.TRIP_VIEW, { kind: 'organization' });
  const isSceneCameraReady = useIsSceneCameraReady();
  const isNight = useWarehouseYardLight(timeZone, isSceneCameraReady && topology != null);
  const [lastParking, setLastParking] = useState<WarehouseSceneParkingValue>();
  const [lastFacts, setLastFacts] = useState<WarehouseYardFactsValue>();
  const receivingArea = topology?.receivingArea;
  const areaId = receivingArea?.id;
  const hasDock = receivingArea?.unloadingPoint?.position !== undefined;
  const canLoadTrips = canViewTrips && hasDock;
  const tripQuery = useTrips(canLoadTrips);
  const visibleTrips = canLoadTrips && !isReadAccessDenied(tripQuery.error) ? tripQuery : undefined;
  const scope = warehouseWorkspaceKey({ organizationId, userId, warehouseId }).join(':');
  const yardsScope = `${scope}:${String(picking !== undefined)}:${String(receiving !== undefined)}:${String(visibleTrips !== undefined)}`;
  const isRefreshingYardFacts = useWarehouseYardRefresh(yardsScope, picking, receiving, visibleTrips);
  const source = useMemo(() => ({
    picking: picking?.data, receiving: receiving?.data, scope: yardsScope, trips: visibleTrips?.data, warehouseId,
  }), [picking?.data, receiving?.data, visibleTrips?.data, warehouseId, yardsScope]);
  const facts = acceptWarehouseYardFacts(lastFacts, source);
  const { knownPickupDeals, picking: acceptedPicking, receiving: acceptedReceiving, trips } = facts;
  const isAwaitingFacts = visibleTrips?.isPending === true || picking?.isPending === true || receiving?.isPending === true;
  const cargo = useMemo(
    () => isAwaitingFacts || (acceptedReceiving === undefined && acceptedPicking === undefined)
      ? undefined
      : projectWarehouseCargo(acceptedReceiving ?? [], areaId, hasDock, { knownPickupDeals, picking: acceptedPicking, trips, warehouseId }),
    [acceptedPicking, acceptedReceiving, areaId, hasDock, isAwaitingFacts, knownPickupDeals, trips, warehouseId],
  );
  const dockIds = useMemo(() => readWarehouseReceivingDocks(receivingArea).map(dock => dock.id), [receivingArea]);
  const parking = useMemo(
    () => readWarehouseSceneParking(lastParking, yardsScope, cargo?.dockVisits, dockIds, cargo?.dockTaskId),
    [cargo, dockIds, lastParking, yardsScope],
  );
  const sceneData = useMemo((): undefined | WarehouseSceneDataValue => topology == null
    ? undefined
    : { parkingCapacity: parking.capacity, topology }, [parking.capacity, topology]);

  const handleCellSelect = useCallback((id: string): void => {
    navigate({ kind: 'object', object: { id, type: 'cell' } });
  }, [navigate]);

  if (parking !== lastParking) {
    setLastParking(parking);
  }
  if (lastFacts !== facts) {
    setLastFacts(facts);
  }

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
        isNight,
        isRefreshingYardFacts,
        onCellSelect: handleCellSelect,
        parkingCapacity: parking.capacity,
        scannedCell,
        selectedCellId,
        yardDrag,
      }}
      key={yardsScope}
      label={label}
      loadScene={loadWarehouseScene}
      sceneData={sceneData}
    />
  );
};

export const WarehouseSceneControls = SceneCameraControls;

export default WarehouseWorkspaceScene;
