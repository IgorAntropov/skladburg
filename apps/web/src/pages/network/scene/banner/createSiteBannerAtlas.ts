import {
  CanvasTexture,
  SRGBColorSpace,
} from 'three';

import type { ISiteBannerCellLookup } from './createSiteBannerCellLookup';
import type { SiteBannerDrawContextValue } from './drawSiteBannerAtlas';
import type { SiteBannerColorsValue } from './siteBannerColors';
import type { SiteBannerEntryValue } from './siteBannerEntry';
import type {
  ISiteBannerLogoLoader,
  SiteBannerLogoImageValue,
} from './siteBannerLogos';

import { createSiteBannerCellLookup } from './createSiteBannerCellLookup';
import { drawSiteBannerAtlas } from './drawSiteBannerAtlas';
import { computeSiteBannerAtlasLayout } from './siteBannerAtlasLayout';
import { buildSiteBannerColorsSignature } from './siteBannerColors';
import { isSiteBannerFontReady } from './siteBannerFonts';
import {
  listSiteBannerLogoPaths,
  siteBannerLogoLoader,
} from './siteBannerLogos';

export interface ISiteBannerAtlas extends ISiteBannerCellLookup {
  dispose: () => void;
  redraw: (colors: SiteBannerColorsValue) => boolean;
  texture: CanvasTexture;
}

export interface SiteBannerAtlasDependenciesValue {
  createSurface: (width: number, height: number) => SiteBannerSurfaceValue;
  isFontReady: () => boolean;
  peekLogo: (path: string) => SiteBannerLogoImageValue | undefined;
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

export const createDomSiteBannerAtlasDependencies = (
  logoLoader: ISiteBannerLogoLoader,
): SiteBannerAtlasDependenciesValue => ({
  createSurface: createDomSurface,
  isFontReady: isSiteBannerFontReady,
  peekLogo: logoLoader.peek,
});

const DOM_DEPENDENCIES = createDomSiteBannerAtlasDependencies(siteBannerLogoLoader);

const FIRST_PIXEL_SIZE_PX = 1;

const isCanvasReadable = (context: SiteBannerDrawContextValue): boolean => {
  try {
    context.getImageData(0, 0, FIRST_PIXEL_SIZE_PX, FIRST_PIXEL_SIZE_PX);

    return true;
  }
  catch (error: unknown) {
    console.log('> SiteBannerAtlas -> redraw:', { error, reason: 'the canvas is not readable, logos are off' });

    return false;
  }
};

const readNoLogo = (): undefined => undefined;

export const createSiteBannerAtlas = (
  entries: readonly SiteBannerEntryValue[],
  anisotropy: number,
  dependencies: SiteBannerAtlasDependenciesValue = DOM_DEPENDENCIES,
): ISiteBannerAtlas => {
  const layout = computeSiteBannerAtlasLayout(entries.length);
  const surface = dependencies.createSurface(layout.width, layout.height);
  const texture = new CanvasTexture(surface.canvas);
  const { getFarCell, getNearCell } = createSiteBannerCellLookup(layout, entries);
  const logoPaths = listSiteBannerLogoPaths(entries.slice(0, layout.capacity));
  let context = surface.context;
  let areLogosBlocked = false;
  let drawnSignature: string | undefined;

  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.max(1, Math.min(SITE_BANNER_MAX_ANISOTROPY, anisotropy));

  const listReadyLogos = (): Map<string, SiteBannerLogoImageValue> => {
    const readyLogos = new Map<string, SiteBannerLogoImageValue>();

    if (areLogosBlocked) {
      return readyLogos;
    }

    for (const path of logoPaths) {
      const logo = dependencies.peekLogo(path);

      if (logo !== undefined) {
        readyLogos.set(path, logo);
      }
    }

    return readyLogos;
  };

  const buildSignature = (colors: SiteBannerColorsValue, readyPaths: Iterable<string>): string => [
    buildSiteBannerColorsSignature(colors),
    dependencies.isFontReady() ? 'font' : 'fallback',
    [...readyPaths].toSorted().join('\n'),
  ].join('|');

  const redraw = (colors: SiteBannerColorsValue): boolean => {
    const readyLogos = listReadyLogos();
    const signature = buildSignature(colors, readyLogos.keys());

    if (signature === drawnSignature) {
      return false;
    }

    drawSiteBannerAtlas(context, layout, entries, colors, path => readyLogos.get(path));

    if (readyLogos.size > 0 && !isCanvasReadable(context)) {
      const cleanSurface = dependencies.createSurface(layout.width, layout.height);

      areLogosBlocked = true;
      context = cleanSurface.context;
      texture.image = cleanSurface.canvas;
      drawSiteBannerAtlas(context, layout, entries, colors, readNoLogo);
      drawnSignature = buildSignature(colors, []);
    }
    else {
      drawnSignature = signature;
    }

    texture.needsUpdate = true;

    return true;
  };

  const dispose = (): void => {
    texture.dispose();
  };

  return { dispose, getFarCell, getNearCell, redraw, texture };
};
