import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
import { useViewportClass } from '@/shared/lib/viewport';
import {
  useAddress,
  useNavigate,
} from '@/shared/routing';
import { Button } from '@/shared/ui';
import {
  SceneCameraControls,
  ScenePlaceholder,
  SceneViewport,
  useIsSceneCameraReady,
} from '@/widgets/scene-viewport';

import type { WarehouseWorkspaceValue } from '../api/useWarehouseWorkspace';
import type { WarehouseWorkTranslate } from '../i18n/workspaceSection';
import type {
  WarehouseConstructionLayerProps,
  WarehouseSceneDataValue,
  WarehouseSceneInteractionValue,
} from '../model/warehouseSceneInteraction';
import type { WarehouseSceneParkingValue } from '../model/warehouseSceneParking';
import type { WarehouseYardFactsValue } from '../model/warehouseYardFacts';
import type { WarehouseYardVehicleMarkingVisualValue } from '../model/warehouseYardVehicleMarkingVisual';

import { useWarehouseSceneStaff } from '../api/useWarehouseSceneStaff';
import { useWarehouseYardLight } from '../api/useWarehouseYardLight';
import { useWarehouseYardRefresh } from '../api/useWarehouseYardRefresh';
import { warehouseWorkspaceKey } from '../api/warehouseWorkspaceKey';
import { warehouseSceneMessages } from '../i18n/warehouseSceneRu';
import { projectWarehouseCargo } from '../model/projectWarehouseCargo';
import { readWarehouseReceivingDocks } from '../model/warehouseReceivingDocks';
import { readWarehouseSceneParking } from '../model/warehouseSceneParking';
import { acceptWarehouseYardFacts } from '../model/warehouseYardFacts';
import { WarehouseStaffSceneDialog } from './workspace/WarehouseStaffSceneDialog';

const loadWarehouseScene = createCachedModuleLoader(() => import('../scene/WarehouseWorldScene'));
const loadWarehouseConstruction = createCachedModuleLoader(() => import('../scene/WarehouseConstruction'));

interface WarehouseWorkspaceSceneProps extends Omit<
  WarehouseSceneInteractionValue,
  | 'cargo'
  | 'constructionLayer'
  | 'focusRequest'
  | 'formatStaffOverflow'
  | 'isCameraReady'
  | 'isNight'
  | 'isRefreshingYardFacts'
  | 'onCellSelect'
  | 'onStaffSelect'
  | 'parkingCapacity'
  | 'selectedStaffId'
  | 'staffAreas'
  | 'staffOverlayHost'
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
  balances, construction, isLoading, label, picking, receiving, scannedCell, selectedCellId, timeZone, topology,
  vehicleMarkings, warehouseId, yardDrag,
}: WarehouseWorkspaceSceneProps): ReactElement => {
  const { createSectionTranslator, t } = useI18n();
  const navigate = useNavigate();
  const { focusRequest } = useAddress();
  const { organizationId, userId } = useActingContext();
  const canViewTrips = useCan(PermissionCode.TRIP_VIEW, { kind: 'organization' });
  const isSceneCameraReady = useIsSceneCameraReady();
  const staff = useWarehouseSceneStaff(warehouseId, isSceneCameraReady && topology != null, focusRequest);
  const isNight = useWarehouseYardLight(timeZone, isSceneCameraReady && topology != null);
  const [lastParking, setLastParking] = useState<WarehouseSceneParkingValue>();
  const [lastFacts, setLastFacts] = useState<WarehouseYardFactsValue>();
  const viewportRef = useRef<HTMLDivElement>(null);
  const staffOverlayHost = useRef<HTMLDivElement>(null);
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
  const { dockVisits, yardVisits } = cargo ?? {};
  const sceneMarkings = useMemo((): ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined => {
    if (yardVisits === undefined || vehicleMarkings === undefined) {
      return undefined;
    }

    const result = new Map<string, WarehouseYardVehicleMarkingVisualValue>();
    for (const { taskId } of [...dockVisits ?? [], ...yardVisits.values()]) {
      const marking = vehicleMarkings.get(taskId);
      if (marking !== undefined) {
        result.set(taskId, marking);
      }
    }
    return result;
  }, [dockVisits, vehicleMarkings, yardVisits]);
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
    <div aria-label={label} className="relative size-full" ref={viewportRef} role="group" tabIndex={-1}>
      <SceneViewport
        interaction={{
          balances,
          cargo,
          construction,
          constructionLayer: WarehouseConstructionLayer,
          focusRequest,
          formatStaffOverflow: staff.formatStaffOverflow,
          isCameraReady: isSceneCameraReady,
          isNight,
          isRefreshingYardFacts,
          onCellSelect: handleCellSelect,
          onStaffSelect: staff.selectStaff,
          parkingCapacity: parking.capacity,
          scannedCell,
          selectedCellId,
          selectedStaffId: staff.selectedStaffId,
          staffAreas: staff.staffAreas,
          staffOverlayHost,
          vehicleMarkings: sceneMarkings,
          yardDrag,
        }}
        key={yardsScope}
        label={label}
        loadScene={loadWarehouseScene}
        sceneData={sceneData}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" ref={staffOverlayHost} />
      {staff.selectedStaffId !== undefined && (
        <WarehouseStaffSceneDialog
          fallbackFocus={viewportRef}
          onClose={staff.closeProfile}
          staffId={staff.selectedStaffId}
          warehouseId={warehouseId}
        />
      )}
    </div>
  );
};

export const WarehouseSceneControls = SceneCameraControls;

export interface WarehouseSceneViewToggleProps {
  isSceneOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  panelId: string;
  t: WarehouseWorkTranslate;
}

export const WarehouseSceneViewToggle = ({
  isSceneOpen, onOpenChange, panelId, t,
}: WarehouseSceneViewToggleProps): null | ReactElement => {
  const isCameraReady = useIsSceneCameraReady();
  const viewport = useViewportClass();
  const isAvailable = isCameraReady && viewport !== 'phone';

  const handleToggle = (): void => {
    onOpenChange(!isSceneOpen);
  };

  useLayoutEffect(() => {
    if (!isAvailable && isSceneOpen) {
      onOpenChange(false);
    }
  }, [isAvailable, isSceneOpen, onOpenChange]);

  return isAvailable
    ? (
        <Button
          aria-controls={panelId}
          aria-expanded={!isSceneOpen}
          data-testid="warehouse-scene-view-toggle"
          onClick={handleToggle}
          variant="secondary"
        >
          {t(isSceneOpen ? 'warehouseWork.returnToWork' : 'warehouseWork.viewScene')}
        </Button>
      )
    : null;
};

export default WarehouseWorkspaceScene;
