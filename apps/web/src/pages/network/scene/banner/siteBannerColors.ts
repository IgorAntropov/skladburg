import type { WorldPaletteValue } from '@/shared/3d';
import type { RgbaColorValue } from '@/shared/lib/color';

export interface SiteBannerColorsValue {
  carrier: string;
  customer: string;
  plate: string;
  rim: string;
  supplier: string;
  text: string;
}

export const toCssColor = (color: RgbaColorValue): string => (
  `rgba(${String(Math.round(color.red))}, ${String(Math.round(color.green))}, ${String(Math.round(color.blue))}, ${String(color.alpha)})`
);

export const readSiteBannerColors = (palette: WorldPaletteValue): SiteBannerColorsValue => ({
  carrier: toCssColor(palette.sideCarrier),
  customer: toCssColor(palette.sideCustomer),
  plate: toCssColor(palette.bannerPlate),
  rim: toCssColor(palette.sideRim),
  supplier: toCssColor(palette.sideSupplier),
  text: toCssColor(palette.bannerText),
});

export const buildSiteBannerColorsSignature = (colors: SiteBannerColorsValue): string => [
  colors.carrier,
  colors.customer,
  colors.plate,
  colors.rim,
  colors.supplier,
  colors.text,
].join('|');
