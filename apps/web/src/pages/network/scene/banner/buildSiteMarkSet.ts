import type {
  MapSideValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import type { NetworkSceneBuildingValue } from '../layout';
import type { ISiteBannerCellLookup } from './createSiteBannerCellLookup';
import type { SiteBannerCellUvValue } from './siteBannerAtlasLayout';

import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import {
  PLAZA_HEIGHT_METERS,
  SITE_MARK_CENTER_HEIGHT_METERS,
} from '../geometry/networkSceneMetrics';
import { applySiteMarkAzimuth } from '../geometry/siteMarkOrientation';
import {
  SITE_MARK_OWN_FAR_RIGHT_METERS,
  SITE_MARK_OWN_FAR_UP_METERS,
  SITE_MARK_OWN_NEAR_RIGHT_METERS,
  SITE_MARK_OWN_NEAR_UP_METERS,
  SITE_MARK_POST_TOP_METERS,
  SITE_MARK_POST_WIDTH_METERS,
} from './siteMarkMetrics';

export interface SiteMarkSetValue {
  count: number;
  farCells: Float32Array;
  hoverMask: Uint8Array;
  markerMatrices: Float32Array;
  matrices: Float32Array;
  nearCells: Float32Array;
  ownSlots: readonly number[];
  postMatrices: Float32Array;
  slotBySiteId: ReadonlyMap<string, number>;
}

const CELL_ITEM_SIZE = 4;
const RIGHT_COLUMN_OFFSET = 0;
const UP_COLUMN_OFFSET = 4;
const POSITION_OFFSET = 12;
const COLUMNS_END_OFFSET = 12;
const MATRIX_LAST_OFFSET = 15;

type SidedCompanyValue = NetworkSceneBuildingValue & { side: MapSideValue };

const isSidedCompany = (building: NetworkSceneBuildingValue): building is SidedCompanyValue => (
  building.isCompany && building.side !== undefined
);

const writeCell = (target: Float32Array, slot: number, cell: SiteBannerCellUvValue): void => {
  const offset = slot * CELL_ITEM_SIZE;

  target[offset] = cell.u0;
  target[offset + 1] = cell.u1;
  target[offset + 2] = cell.v0;
  target[offset + 3] = cell.v1;
};

export const writeSiteMarkMarkerMatrices = (set: SiteMarkSetValue, isFar: boolean): void => {
  const offsetRight = isFar ? SITE_MARK_OWN_FAR_RIGHT_METERS : SITE_MARK_OWN_NEAR_RIGHT_METERS;
  const offsetUp = isFar ? SITE_MARK_OWN_FAR_UP_METERS : SITE_MARK_OWN_NEAR_UP_METERS;
  const { markerMatrices: target, matrices: source } = set;

  for (let markerIndex = 0; markerIndex < set.ownSlots.length; markerIndex += 1) {
    const slot = set.ownSlots[markerIndex] ?? 0;
    const from = slot * INSTANCE_MATRIX_ITEM_SIZE;
    const to = markerIndex * INSTANCE_MATRIX_ITEM_SIZE;

    for (let offset = 0; offset < COLUMNS_END_OFFSET; offset += 1) {
      target[to + offset] = source[from + offset] ?? 0;
    }

    for (let axis = 0; axis < 3; axis += 1) {
      target[to + POSITION_OFFSET + axis] = (source[from + POSITION_OFFSET + axis] ?? 0)
        + (source[from + RIGHT_COLUMN_OFFSET + axis] ?? 0) * offsetRight
        + (source[from + UP_COLUMN_OFFSET + axis] ?? 0) * offsetUp;
    }

    target[to + MATRIX_LAST_OFFSET] = 1;
  }
};

export const fillSiteMarkHoverMask = (
  set: SiteMarkSetValue,
  hoveredId: string | undefined,
  hoveredSiteIds: readonly string[],
): void => {
  set.hoverMask.fill(0);

  const hoveredSlot = hoveredId === undefined ? undefined : set.slotBySiteId.get(hoveredId);

  if (hoveredSlot !== undefined) {
    set.hoverMask[hoveredSlot] = 1;
  }

  for (const siteId of hoveredSiteIds) {
    const slot = set.slotBySiteId.get(siteId);

    if (slot !== undefined) {
      set.hoverMask[slot] = 1;
    }
  }
};

export const buildSiteMarkSet = (
  buildings: readonly NetworkSceneBuildingValue[],
  sites: readonly NetworkMapSiteValue[],
  atlas: ISiteBannerCellLookup,
): SiteMarkSetValue => {
  const organizationIdBySiteId = new Map(sites.map((site): [string, string] => [site.id, site.organizationId]));
  const companies = buildings.filter(isSidedCompany);
  const matrices = new Float32Array(companies.length * INSTANCE_MATRIX_ITEM_SIZE);
  const postMatrices = new Float32Array(companies.length * INSTANCE_MATRIX_ITEM_SIZE);
  const nearCells = new Float32Array(companies.length * CELL_ITEM_SIZE);
  const farCells = new Float32Array(companies.length * CELL_ITEM_SIZE);
  const ownSlots: number[] = [];
  const slotBySiteId = new Map<string, number>();

  for (const [slot, building] of companies.entries()) {
    const siteId = building.siteId ?? building.id;
    const organizationId = organizationIdBySiteId.get(siteId) ?? '';
    const { side } = building;

    writeInstanceMatrix(matrices, slot, {
      rotationY: 0,
      scale: [1, 1, 1],
      x: building.x,
      y: SITE_MARK_CENTER_HEIGHT_METERS,
      z: building.z,
    });
    writeInstanceMatrix(postMatrices, slot, {
      rotationY: 0,
      scale: [SITE_MARK_POST_WIDTH_METERS, SITE_MARK_POST_TOP_METERS - PLAZA_HEIGHT_METERS, SITE_MARK_POST_WIDTH_METERS],
      x: building.x,
      y: PLAZA_HEIGHT_METERS,
      z: building.z,
    });
    writeCell(nearCells, slot, atlas.getNearCell(organizationId, side));
    writeCell(farCells, slot, atlas.getFarCell(side));
    slotBySiteId.set(siteId, slot);

    if (building.isOwn) {
      ownSlots.push(slot);
    }
  }

  applySiteMarkAzimuth(matrices, companies.length, 0, undefined);

  const set: SiteMarkSetValue = {
    count: companies.length,
    farCells,
    hoverMask: new Uint8Array(companies.length),
    markerMatrices: new Float32Array(ownSlots.length * INSTANCE_MATRIX_ITEM_SIZE),
    matrices,
    nearCells,
    ownSlots,
    postMatrices,
    slotBySiteId,
  };

  writeSiteMarkMarkerMatrices(set, true);

  return set;
};
