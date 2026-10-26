import type { MapSideValue } from '@/entities/network';
import type { MonogramPartsValue } from '@/entities/organization';

export interface SiteBannerEntryValue {
  monogram: MonogramPartsValue;
  organizationId: string;
  side: MapSideValue;
}
