import { CityTier } from '@skladburg/contracts/network/v1/network';

import type { NetworkCityTierValue } from '../model/networkMapTypes';

export const toNetworkCityTier = (tier: CityTier): NetworkCityTierValue => {
  switch (tier) {
    case CityTier.LARGE:
      return 'large';
    case CityTier.SMALL:
      return 'small';
    default:
      return 'medium';
  }
};
