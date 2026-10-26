import {
  CanvasTexture,
  SRGBColorSpace,
} from 'three';

import type { ISiteBannerCellLookup } from './createSiteBannerCellLookup';
import type { SiteBannerDrawContextValue } from './drawSiteBannerAtlas';
import type { SiteBannerColorsValue } from './siteBannerColors';
import type { SiteBannerEntryValue } from './siteBannerEntry';

import { createSiteBannerCellLookup } from './createSiteBannerCellLookup';
import { drawSiteBannerAtlas } from './drawSiteBannerAtlas';
import { computeSiteBannerAtlasLayout } from './siteBannerAtlasLayout';
import { buildSiteBannerColorsSignature } from './siteBannerColors';
import { isSiteBannerFontReady } from './siteBannerFonts';

export interface ISiteBannerAtlas extends ISiteBannerCellLookup {
  dispose: () => void;
  redraw: (colors: SiteBannerColorsValue) => boolean;
  texture: CanvasTexture;
}

export interface SiteBannerAtlasDependenciesValue {
  createSurface: (width: number, height: number) => SiteBannerSurfaceValue;
  isFontReady: () => boolean;
}

export interface SiteBannerSurfaceValue {
  canvas: HTMLCanvasElement;
  context: SiteBannerDrawContextValue;
}

export const SITE_BANNER_MAX_ANISOTROPY = 4;

const createDomSurface = (width: number, height: number): SiteBannerSurfaceValue => {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (context === null) {
    throw new Error('The site banner atlas canvas has no 2d context');
  }

  return { canvas, context };
};

const DOM_DEPENDENCIES: SiteBannerAtlasDependenciesValue = {
  createSurface: createDomSurface,
  isFontReady: isSiteBannerFontReady,
};

export const createSiteBannerAtlas = (
  entries: readonly SiteBannerEntryValue[],
  anisotropy: number,
  dependencies: SiteBannerAtlasDependenciesValue = DOM_DEPENDENCIES,
): ISiteBannerAtlas => {
  const layout = computeSiteBannerAtlasLayout(entries.length);
  const { canvas, context } = dependencies.createSurface(layout.width, layout.height);
  const texture = new CanvasTexture(canvas);
  const { getFarCell, getNearCell } = createSiteBannerCellLookup(layout, entries);
  let drawnSignature: string | undefined;

  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.max(1, Math.min(SITE_BANNER_MAX_ANISOTROPY, anisotropy));

  const redraw = (colors: SiteBannerColorsValue): boolean => {
    const signature = `${buildSiteBannerColorsSignature(colors)}|${dependencies.isFontReady() ? 'font' : 'fallback'}`;

    if (signature === drawnSignature) {
      return false;
    }

    drawSiteBannerAtlas(context, layout, entries, colors);
    drawnSignature = signature;
    texture.needsUpdate = true;

    return true;
  };

  const dispose = (): void => {
    texture.dispose();
  };

  return { dispose, getFarCell, getNearCell, redraw, texture };
};
