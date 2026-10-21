export interface NetworkFocusRequestValue {
  id: string;
  sequence: number;
}

export type NetworkMapTargetKindValue = 'city' | 'site';

export interface NetworkMapTargetValue {
  id: string;
  kind: NetworkMapTargetKindValue;
}

export interface NetworkSceneInteractionValue {
  focusRequest: NetworkFocusRequestValue | undefined;
  hoveredId: string | undefined;
  onHoverEnd: (id: string) => void;
  onHoverStart: (id: string) => void;
  onSelect: (target: NetworkMapTargetValue) => void;
  selected: NetworkMapTargetValue | undefined;
}
