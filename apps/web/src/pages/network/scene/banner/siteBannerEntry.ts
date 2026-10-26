import type { MapSideValue } from '@/entities/network';
import type { MonogramPartsValue } from '@/entities/organization';

export interface SiteBannerEntryValue {
  logoPath: string;
  monogram: MonogramPartsValue;
  organizationId: string;
  side: MapSideValue;
}
