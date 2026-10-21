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

import { createUnitBoxGeometry } from './geometry/createUnitBoxGeometry';
import { useNetworkCameraFocus } from './interaction/useNetworkCameraFocus';
import { useNetworkPointerPicking } from './interaction/useNetworkPointerPicking';
import { NetworkBuildings } from './layers/NetworkBuildings';
import { NetworkCityLabels } from './layers/NetworkCityLabels';
import { NetworkCityPlazas } from './layers/NetworkCityPlazas';
import { NetworkRoads } from './layers/NetworkRoads';
import { NetworkSelectionCorners } from './layers/NetworkSelectionCorners';
import { NetworkSiteChips } from './layers/NetworkSiteChips';
import { buildNetworkSceneLayout } from './layout';
import { NETWORK_WORLD_SEED } from './networkWorldConstants';

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

  useNetworkCameraFocus(layout, interaction);
  useNetworkPointerPicking(layout, interaction);

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
      <NetworkCityPlazas cities={layout.cities} hasShadowReceive={hasShadows} />
      <NetworkBuildings boxGeometry={boxGeometry} buildings={layout.buildings} level={level} />
      <NetworkSelectionCorners
        boxGeometry={boxGeometry}
        buildings={layout.buildings}
        cities={layout.cities}
        selectedId={interaction?.selected?.id}
      />
      <NetworkSiteChips boxGeometry={boxGeometry} buildings={layout.buildings} hoveredId={interaction?.hoveredId} />
      <NetworkCityLabels cities={layout.cities} hoveredId={interaction?.hoveredId} selectedId={interaction?.selected?.id} />
    </>
  );
};

export default NetworkWorldScene;
