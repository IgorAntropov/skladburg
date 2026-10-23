import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import type { NetworkMapModelValue } from '@/entities/network';
import type {
  SceneContentProps,
  SceneWorldValue,
} from '@/shared/3d';

import {
  loadWorldTerrain,
  QUALITY_LEVEL_SETTINGS,
  WorldTerrain,
} from '@/shared/3d';

import type { NetworkSceneInteractionValue } from '../model/networkSceneInteraction';
import type {
  NetworkSceneBuildingValue,
  NetworkSceneLayoutValue,
} from './layout';
import type { WorldModelDataValue } from './models/format/worldModelFormat';

import { createUnitBoxGeometry } from './geometry/createUnitBoxGeometry';
import { EMPTY_ID_LIST } from './geometry/emptyIdList';
import { listSelectedIds } from './geometry/selectionFrame';
import { useNetworkCameraFocus } from './interaction/useNetworkCameraFocus';
import { useNetworkPointerPicking } from './interaction/useNetworkPointerPicking';
import { NetworkBuildings } from './layers/NetworkBuildings';
import { NetworkCityLabels } from './layers/NetworkCityLabels';
import { NetworkCityPlazas } from './layers/NetworkCityPlazas';
import { NetworkLampLight } from './layers/NetworkLampLight';
import { NetworkModelBuildings } from './layers/NetworkModelBuildings';
import { NetworkRoads } from './layers/NetworkRoads';
import { NetworkSelectionCorners } from './layers/NetworkSelectionCorners';
import { NetworkShadowBlobs } from './layers/NetworkShadowBlobs';
import { NetworkSiteChips } from './layers/NetworkSiteChips';
import { NetworkStreetLamps } from './layers/NetworkStreetLamps';
import { NetworkWindows } from './layers/NetworkWindows';
import { useGlowProgramWarmup } from './layers/useGlowProgramWarmup';
import { buildNetworkSceneLayout } from './layout';
import { loadWorldModels } from './models/loadWorldModels';
import { pickCompanyWarehouseModel } from './models/pickCompanyWarehouseModel';
import { COMPANY_WAREHOUSE_MODEL_ID } from './models/worldModelCatalog';
import { NETWORK_WORLD_SEED } from './networkWorldConstants';
import {
  buildStreetLamps,
  buildWindowInstances,
} from './night';

const createTerrainParams = (layout: NetworkSceneLayoutValue): Parameters<typeof loadWorldTerrain>[0] => ({
  reserved: layout.terrainReserved,
  seed: NETWORK_WORLD_SEED,
  world: layout.world,
});

const COMPANY_WAREHOUSE_MODEL_IDS: readonly string[] = [COMPANY_WAREHOUSE_MODEL_ID];

const isModelBuilding = (building: NetworkSceneBuildingValue): boolean => pickCompanyWarehouseModel(building) !== undefined;

const loadCompanyModels = async (): Promise<void> => {
  try {
    await loadWorldModels(COMPANY_WAREHOUSE_MODEL_IDS);
  }
  catch (error) {
    console.log('> NetworkWorldScene -> prepare:', { error, ids: COMPANY_WAREHOUSE_MODEL_IDS });
  }
};

export const prepare = async (data: NetworkMapModelValue): Promise<void> => {
  await Promise.all([loadWorldTerrain(createTerrainParams(buildNetworkSceneLayout(data))), loadCompanyModels()]);
};

export const resolveWorld = (data: NetworkMapModelValue): SceneWorldValue => buildNetworkSceneLayout(data).world;

const NetworkWorldScene = ({
  data,
  interaction,
  level,
}: SceneContentProps<NetworkMapModelValue, NetworkSceneInteractionValue | undefined>): ReactElement => {
  const layout = buildNetworkSceneLayout(data);
  const terrain = loadWorldTerrain.peek(createTerrainParams(layout));
  const { hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const warehouseModel = loadWorldModels.peek(COMPANY_WAREHOUSE_MODEL_ID);
  const models = useMemo(
    (): ReadonlyMap<string, WorldModelDataValue> => (
      warehouseModel === undefined ? new Map() : new Map([[COMPANY_WAREHOUSE_MODEL_ID, warehouseModel]])
    ),
    [warehouseModel],
  );
  const hasWarehouseModel = warehouseModel !== undefined;
  const modelBuildings = useMemo(
    () => warehouseModel === undefined ? [] : layout.buildings.filter(isModelBuilding),
    [layout.buildings, warehouseModel],
  );
  const boxBuildings = useMemo(
    () => warehouseModel === undefined ? layout.buildings : layout.buildings.filter(building => !isModelBuilding(building)),
    [layout.buildings, warehouseModel],
  );
  const boxGeometry = useMemo((): BufferGeometry => createUnitBoxGeometry(), []);
  const windows = useMemo(() => buildWindowInstances(layout.buildings, layout.cities), [layout.buildings, layout.cities]);
  const lamps = useMemo(() => buildStreetLamps(layout.roads, layout.cities), [layout.cities, layout.roads]);
  const selected = interaction?.selected;
  const selectedIds = useMemo(() => listSelectedIds(selected), [selected]);
  const hoveredId = interaction?.hoveredId;
  const hoveredSiteIds = interaction?.hoveredSiteIds ?? EMPTY_ID_LIST;

  useNetworkCameraFocus(layout, interaction);
  useNetworkPointerPicking(layout, interaction);
  useGlowProgramWarmup();

  useEffect(() => {
    return () => {
      boxGeometry.dispose();
    };
  }, [boxGeometry]);

  if (terrain === undefined) {
    throw new Error('The network world terrain is not prepared');
  }

  return (
    <>
      <WorldTerrain level={level} terrain={terrain} />
      <NetworkRoads hasShadowReceive={hasShadows} roads={layout.roads} />
      <NetworkStreetLamps boxGeometry={boxGeometry} lamps={lamps} level={level} />
      <NetworkCityPlazas cities={layout.cities} hasShadowReceive={hasShadows} />
      <NetworkShadowBlobs buildings={layout.buildings} level={level} terrain={terrain} />
      <NetworkBuildings boxGeometry={boxGeometry} buildings={boxBuildings} level={level} />
      {hasWarehouseModel && (
        <NetworkModelBuildings
          buildings={modelBuildings}
          level={level}
          models={models}
          pickModel={pickCompanyWarehouseModel}
        />
      )}
      <NetworkWindows level={level} windows={windows} />
      <NetworkSelectionCorners
        boxGeometry={boxGeometry}
        buildings={layout.buildings}
        cities={layout.cities}
        selectedIds={selectedIds}
      />
      <NetworkSiteChips
        boxGeometry={boxGeometry}
        buildings={layout.buildings}
        hoveredId={hoveredId}
        hoveredSiteIds={hoveredSiteIds}
      />
      <NetworkLampLight lamps={lamps} level={level} />
      <NetworkCityLabels
        cities={layout.cities}
        hoveredId={hoveredId}
        hoveredSiteIds={hoveredSiteIds}
        selectedIds={selectedIds}
      />
    </>
  );
};

export default NetworkWorldScene;
