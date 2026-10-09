export interface HudSkeletonListsValue {
  hasHeader: boolean;
}

export interface HudSkeletonZonesValue {
  hasInspector: boolean;
  hasKpi: boolean;
  hasPanel: boolean;
  hasTracker: boolean;
  lists: HudSkeletonListsValue | undefined;
}
