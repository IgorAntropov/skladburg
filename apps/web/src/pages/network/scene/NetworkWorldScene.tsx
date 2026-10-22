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
import type { NetworkSceneLayoutValue } from './layout';

import { EMPTY_ID_LIST } from '../model/networkSceneInteraction';
import { createUnitBoxGeometry } from './geometry/createUnitBoxGeometry';
import { listSelectedIds } from './geometry/selectionFrame';
import { useNetworkCameraFocus } from './interaction/useNetworkCameraFocus';
import { useNetworkPointerPicking } from './interaction/useNetworkPointerPicking';
import { NetworkBuildings } from './layers/NetworkBuildings';
import { NetworkCityLabels } from './layers/NetworkCityLabels';
import { NetworkCityPlazas } from './layers/NetworkCityPlazas';
import { NetworkLampLight } from './layers/NetworkLampLight';
import { NetworkRoads } from './layers/NetworkRoads';
import { NetworkSelectionCorners } from './layers/NetworkSelectionCorners';
import { NetworkSiteChips } from './layers/NetworkSiteChips';
import { NetworkStreetLamps } from './layers/NetworkStreetLamps';
import { NetworkWindows } from './layers/NetworkWindows';
import { useGlowProgramWarmup } from './layers/useGlowProgramWarmup';
import { buildNetworkSceneLayout } from './layout';
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

export const prepare = async (data: NetworkMapModelValue): Promise<void> => {
  await loadWorldTerrain(createTerrainParams(buildNetworkSceneLayout(data)));
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
      <NetworkBuildings boxGeometry={boxGeometry} buildings={layout.buildings} level={level} />
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
