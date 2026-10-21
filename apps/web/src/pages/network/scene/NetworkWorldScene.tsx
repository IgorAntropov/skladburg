import type { ReactElement } from 'react';

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

import type { NetworkSceneLayoutValue } from './layout';

import { NetworkBuildings } from './layers/NetworkBuildings';
import { NetworkCityLabels } from './layers/NetworkCityLabels';
import { NetworkCityPlazas } from './layers/NetworkCityPlazas';
import { NetworkRoads } from './layers/NetworkRoads';
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

const NetworkWorldScene = ({ data, level }: SceneContentProps<NetworkMapModelValue>): ReactElement => {
  const layout = buildNetworkSceneLayout(data);
  const terrain = loadWorldTerrain.peek(createTerrainParams(layout));
  const { hasShadows } = QUALITY_LEVEL_SETTINGS[level];

  if (terrain === undefined) {
    throw new Error('The network world terrain is not prepared');
  }

  return (
    <>
      <WorldTerrain level={level} terrain={terrain} />
      <NetworkRoads hasShadowReceive={hasShadows} roads={layout.roads} />
      <NetworkCityPlazas cities={layout.cities} hasShadowReceive={hasShadows} />
      <NetworkBuildings buildings={layout.buildings} level={level} />
      <NetworkSiteChips buildings={layout.buildings} />
      <NetworkCityLabels cities={layout.cities} />
    </>
  );
};

export default NetworkWorldScene;
