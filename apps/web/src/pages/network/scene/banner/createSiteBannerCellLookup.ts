import type { MapSideValue } from '@/entities/network';

import type {
  SiteBannerAtlasLayoutValue,
  SiteBannerCellPixelsValue,
  SiteBannerCellUvValue,
} from './siteBannerAtlasLayout';
import type { SiteBannerEntryValue } from './siteBannerEntry';

import {
  readFarCellPixels,
  readNearCellPixels,
  readSharedNearCellPixels,
  toCellUv,
} from './siteBannerAtlasLayout';

export interface ISiteBannerCellLookup {
  getFarCell: (side: MapSideValue) => SiteBannerCellUvValue;
  getNearCell: (organizationId: string, side: MapSideValue) => SiteBannerCellUvValue;
}

export const createSiteBannerCellLookup = (
  layout: SiteBannerAtlasLayoutValue,
  entries: readonly SiteBannerEntryValue[],
): ISiteBannerCellLookup => {
  const indexByOrganizationId = new Map(
    entries.slice(0, layout.capacity).map((entry, index): [string, number] => [entry.organizationId, index]),
  );

  return {
    getFarCell: (side): SiteBannerCellUvValue => toCellUv(layout, readFarCellPixels(side)),
    getNearCell: (organizationId, side): SiteBannerCellUvValue => {
      const index = indexByOrganizationId.get(organizationId);
      const cell: SiteBannerCellPixelsValue = index === undefined
        ? readSharedNearCellPixels(layout, side)
        : readNearCellPixels(layout, index);

      return toCellUv(layout, cell);
    },
  };
};
