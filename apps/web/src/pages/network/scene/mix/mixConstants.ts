import type { NetworkCityTierValue } from '@/entities/network';

export const TIER_SCALES: Readonly<Record<NetworkCityTierValue, number>> = {
  large: 1,
  medium: 0.75,
  small: 0.35,
};

export const MODEL_SHARE_BASE = 0.25;

export const MODEL_SHARE_SPAN = 0.5;

export const OFFICE_MODEL_BONUS = 0.1;

export const MODEL_SHARE_MAX = 0.85;

export const DEFAULT_CITY_TIER: NetworkCityTierValue = 'medium';
