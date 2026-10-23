import type {
  MapSideValue,
  NetworkCityTierValue,
} from '@/entities/network';
import type {
  SceneWorldValue,
  TerrainReservedValue,
} from '@/shared/3d';

export interface LayoutPointValue {
  x: number;
  z: number;
}

export type NetworkSceneBuildingKindValue = 'house' | 'office' | 'warehouse';

export interface NetworkSceneBuildingValue {
  cityId: string;
  depth: number;
  height: number;
  id: string;
  isCompany: boolean;
  isOwn: boolean;
  kind: NetworkSceneBuildingKindValue;
  rank: number;
  rotation: number;
  side: MapSideValue | undefined;
  siteId: string | undefined;
  width: number;
  x: number;
  z: number;
}

export interface NetworkSceneCityValue {
  cityId: string;
  hiddenSiteIds: readonly string[];
  id: string;
  name: string;
  radius: number;
  tier: NetworkCityTierValue;
  x: number;
  z: number;
}

export interface NetworkSceneLayoutValue {
  buildings: readonly NetworkSceneBuildingValue[];
  cities: readonly NetworkSceneCityValue[];
  home: SceneWorldValue['home'];
  roads: readonly NetworkSceneRoadValue[];
  terrainReserved: TerrainReservedValue;
  world: SceneWorldValue;
}

export interface NetworkSceneRoadValue {
  from: LayoutPointValue;
  fromCityId: string;
  id: string;
  to: LayoutPointValue;
  toCityId: string;
}
