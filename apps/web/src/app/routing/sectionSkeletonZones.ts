import type {
  AppAddressValue,
  AppSectionValue,
} from '@/shared/routing';
import type { HudSkeletonZonesValue } from '@/widgets/hud-layout';

import {
  getAddressSection,
  parseAddressPath,
} from '@/shared/routing';

export const NEUTRAL_SKELETON_ZONES: HudSkeletonZonesValue = {
  hasInspector: false,
  hasKpi: false,
  hasPanel: false,
  hasTracker: false,
  lists: undefined,
};

const PANEL_SECTION_ZONES: HudSkeletonZonesValue = {
  ...NEUTRAL_SKELETON_ZONES,
  hasInspector: true,
  hasPanel: true,
};

export const SECTION_SKELETON_ZONES: Readonly<Record<AppSectionValue, HudSkeletonZonesValue>> = {
  catalog: PANEL_SECTION_ZONES,
  deals: PANEL_SECTION_ZONES,
  network: {
    ...NEUTRAL_SKELETON_ZONES,
    hasInspector: true,
    hasKpi: true,
    hasTracker: true,
    lists: { hasHeader: false },
  },
  warehouse: {
    ...NEUTRAL_SKELETON_ZONES,
    hasInspector: true,
    lists: { hasHeader: true },
  },
};

export const getSkeletonZones = (address: AppAddressValue | undefined): HudSkeletonZonesValue => {
  const section = address === undefined ? undefined : getAddressSection(address);

  return section === undefined ? NEUTRAL_SKELETON_ZONES : SECTION_SKELETON_ZONES[section];
};

export const getPathSkeletonZones = (path: string): HudSkeletonZonesValue => {
  return getSkeletonZones(parseAddressPath(path));
};
