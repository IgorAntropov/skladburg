import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  NetworkCityTierValue,
  NetworkMapModelValue,
} from '@/entities/network';
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

import { listSiteBannerEntries } from './banner/listSiteBannerEntries';
import { loadSiteBannerFonts } from './banner/siteBannerFonts';
import {
  listSiteBannerLogoPaths,
  siteBannerLogoLoader,
} from './banner/siteBannerLogos';
import { createSiteMarkMode } from './banner/siteMarkMetrics';
import { useSiteBannerAtlas } from './banner/useSiteBannerAtlas';
import { createUnitBoxGeometry } from './geometry/createUnitBoxGeometry';
import { EMPTY_ID_LIST } from './geometry/emptyIdList';
import { listSelectedIds } from './geometry/selectionFrame';
import { useNetworkCameraFocus } from './interaction/useNetworkCameraFocus';
import { useNetworkPointerPicking } from './interaction/useNetworkPointerPicking';
import { NetworkBeveledBuildings } from './layers/NetworkBeveledBuildings';
import { NetworkBuildings } from './layers/NetworkBuildings';
import { NetworkCityLabels } from './layers/NetworkCityLabels';
import { NetworkCityPlazas } from './layers/NetworkCityPlazas';
import { NetworkLampLight } from './layers/NetworkLampLight';
import { NetworkModelBuildings } from './layers/NetworkModelBuildings';
import { NetworkRoads } from './layers/NetworkRoads';
import { NetworkSelectionCorners } from './layers/NetworkSelectionCorners';
import { NetworkShadowBlobs } from './layers/NetworkShadowBlobs';
import { NetworkSiteMarks } from './layers/NetworkSiteMarks';
import { NetworkStreetLamps } from './layers/NetworkStreetLamps';
import { NetworkWindows } from './layers/NetworkWindows';
import { useGlowProgramWarmup } from './layers/useGlowProgramWarmup';
import { buildNetworkSceneLayout } from './layout';
import { createModelWindowSources } from './mix/createModelWindowSources';
import { partitionNetworkBuildings } from './mix/partitionNetworkBuildings';
import { loadWorldModels } from './models/loadWorldModels';
import { useLoadedWorldModels } from './models/useLoadedWorldModels';
import { WORLD_MODEL_CATALOG } from './models/worldModelCatalog';
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

const loadCatalogModels = async (): Promise<void> => {
  const results = await Promise.allSettled(WORLD_MODEL_CATALOG.map(({ id }) => loadWorldModels([id])));

  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      const error: unknown = result.reason;

      console.log('> NetworkWorldScene -> prepare:', { error, id: WORLD_MODEL_CATALOG[index]?.id });
    }
  }
};

const loadSiteLogos = async (data: NetworkMapModelValue): Promise<void> => {
  try {
    const entries = listSiteBannerEntries(buildNetworkSceneLayout(data).buildings, data.sites);

    await siteBannerLogoLoader.load(listSiteBannerLogoPaths(entries));
  }
  catch (error: unknown) {
    console.log('> NetworkWorldScene -> prepare:', { error });
  }
};

export const prepare = async (data: NetworkMapModelValue): Promise<void> => {
  await Promise.all([
    loadWorldTerrain(createTerrainParams(buildNetworkSceneLayout(data))),
    loadCatalogModels(),
    loadSiteBannerFonts(),
    loadSiteLogos(data),
  ]);
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
  const models = useLoadedWorldModels();
  const tierByCityId = useMemo(
    (): ReadonlyMap<string, NetworkCityTierValue> => new Map(layout.cities.map(city => [city.id, city.tier])),
    [layout.cities],
  );
  const { beveled, boxes, placements } = useMemo(
    () => partitionNetworkBuildings(layout.buildings, { level, models, tierByCityId }),
    [layout.buildings, level, models, tierByCityId],
  );
  const boxGeometry = useMemo((): BufferGeometry => createUnitBoxGeometry(), []);
  const [markMode] = useState(createSiteMarkMode);
  const bannerEntries = useMemo(
    () => listSiteBannerEntries(layout.buildings, data.sites),
    [data.sites, layout.buildings],
  );
  const bannerAtlas = useSiteBannerAtlas(bannerEntries);
  const modelWindows = useMemo(() => createModelWindowSources(placements, models), [models, placements]);
  const windows = useMemo(
    () => buildWindowInstances(layout.buildings, layout.cities, modelWindows),
    [layout.buildings, layout.cities, modelWindows],
  );
  const lamps = useMemo(() => buildStreetLamps(layout.roads, layout.cities), [layout.cities, layout.roads]);
  const selected = interaction?.selected;
  const selectedIds = useMemo(() => listSelectedIds(selected), [selected]);
  const hoveredId = interaction?.hoveredId;
  const hoveredSiteIds = interaction?.hoveredSiteIds ?? EMPTY_ID_LIST;

  useNetworkCameraFocus(layout, interaction);
  useNetworkPointerPicking(layout, interaction, markMode);
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
      <NetworkBuildings boxGeometry={boxGeometry} buildings={boxes} level={level} />
      <NetworkBeveledBuildings buildings={beveled} level={level} />
      <NetworkModelBuildings level={level} models={models} placements={placements} />
      <NetworkWindows level={level} windows={windows} />
      <NetworkSelectionCorners
        boxGeometry={boxGeometry}
        buildings={layout.buildings}
        cities={layout.cities}
        selectedIds={selectedIds}
      />
      <NetworkSiteMarks
        atlas={bannerAtlas}
        boxGeometry={boxGeometry}
        buildings={layout.buildings}
        hoveredId={hoveredId}
        hoveredSiteIds={hoveredSiteIds}
        markMode={markMode}
        sites={data.sites}
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
