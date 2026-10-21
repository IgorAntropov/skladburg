import type { NetworkSceneCityValue } from '../layout';

export interface CityLabelStateValue {
  isHovered: boolean;
  isSelected: boolean;
}

export const resolveCityLabelState = (
  city: Pick<NetworkSceneCityValue, 'hiddenSiteIds' | 'id'>,
  hoveredId: string | undefined,
  selectedId: string | undefined,
): CityLabelStateValue => ({
  isHovered: hoveredId !== undefined && hoveredId === city.id,
  isSelected: selectedId !== undefined && (selectedId === city.id || city.hiddenSiteIds.includes(selectedId)),
});
