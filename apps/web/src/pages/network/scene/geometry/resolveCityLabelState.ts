import type { NetworkSceneCityValue } from '../layout';

export interface CityLabelStateValue {
  isHovered: boolean;
  isSelected: boolean;
}

export const resolveCityLabelState = (
  city: Pick<NetworkSceneCityValue, 'hiddenSiteIds' | 'id'>,
  hoveredId: string | undefined,
  hoveredSiteIds: readonly string[],
  selectedIds: readonly string[],
): CityLabelStateValue => ({
  isHovered: (hoveredId !== undefined && hoveredId === city.id)
    || hoveredSiteIds.some(siteId => city.hiddenSiteIds.includes(siteId)),
  isSelected: selectedIds.some(selectedId => selectedId === city.id || city.hiddenSiteIds.includes(selectedId)),
});
