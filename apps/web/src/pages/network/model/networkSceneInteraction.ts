export const EMPTY_ID_LIST: readonly string[] = [];

export interface NetworkFocusRequestValue {
  id: string;
  sequence: number;
  siteIds: readonly string[] | undefined;
}

export type NetworkMapSelectionValue = NetworkMapSitesSelectionValue | NetworkMapTargetValue;

export interface NetworkMapSitesSelectionValue {
  id: string;
  kind: 'sites';
  siteIds: readonly string[];
}

export type NetworkMapTargetKindValue = 'city' | 'site';

export interface NetworkMapTargetValue {
  id: string;
  kind: NetworkMapTargetKindValue;
}

export interface NetworkSceneInteractionValue {
  focusRequest: NetworkFocusRequestValue | undefined;
  hoveredId: string | undefined;
  hoveredSiteIds: readonly string[];
  onHoverEnd: (id: string) => void;
  onHoverStart: (id: string) => void;
  onSelect: (target: NetworkMapTargetValue) => void;
  selected: NetworkMapSelectionValue | undefined;
}
