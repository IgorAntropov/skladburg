import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';

import { useWorldPalette } from '@/shared/3d';

import type { ISiteBannerAtlas } from './createSiteBannerAtlas';
import type { SiteBannerEntryValue } from './siteBannerEntry';
import type { ISiteBannerLogoLoader } from './siteBannerLogos';

import {
  createDomSiteBannerAtlasDependencies,
  createSiteBannerAtlas,
} from './createSiteBannerAtlas';
import { readSiteBannerColors } from './siteBannerColors';
import {
  isSiteBannerFontReady,
  loadSiteBannerFonts,
} from './siteBannerFonts';
import {
  listSiteBannerLogoPaths,
  siteBannerLogoLoader,
} from './siteBannerLogos';

export const useSiteBannerAtlas = (
  entries: readonly SiteBannerEntryValue[],
  logoLoader: ISiteBannerLogoLoader = siteBannerLogoLoader,
): ISiteBannerAtlas | undefined => {
  const palette = useWorldPalette();
  const maxAnisotropy = useThree(state => state.gl.capabilities.getMaxAnisotropy());
  const invalidate = useThree(state => state.invalidate);

  const colors = useMemo(() => readSiteBannerColors(palette), [palette]);
  const atlas = useMemo(
    (): ISiteBannerAtlas | undefined => entries.length === 0
      ? undefined
      : createSiteBannerAtlas(entries, maxAnisotropy, createDomSiteBannerAtlasDependencies(logoLoader)),
    [entries, logoLoader, maxAnisotropy],
  );

  useLayoutEffect(() => {
    if (atlas?.redraw(colors) === true) {
      invalidate();
    }
  }, [atlas, colors, invalidate]);

  useEffect(() => {
    if (atlas === undefined || isSiteBannerFontReady()) {
      return undefined;
    }

    let isCancelled = false;

    loadSiteBannerFonts().then(() => {
      if (!isCancelled && atlas.redraw(colors)) {
        invalidate();
      }
    }).catch((error: unknown) => {
      console.log('> useSiteBannerAtlas -> loadSiteBannerFonts:', { error });
    });

    return (): void => {
      isCancelled = true;
    };
  }, [atlas, colors, invalidate]);

  useEffect(() => {
    if (atlas === undefined) {
      return undefined;
    }

    const missingPaths = listSiteBannerLogoPaths(entries).filter(path => logoLoader.peek(path) === undefined);

    if (missingPaths.length === 0) {
      return undefined;
    }

    let isCancelled = false;

    logoLoader.load(missingPaths).then(() => {
      if (!isCancelled && atlas.redraw(colors)) {
        invalidate();
      }
    }).catch((error: unknown) => {
      console.log('> useSiteBannerAtlas -> loadSiteBannerLogos:', { error });
    });

    return (): void => {
      isCancelled = true;
    };
  }, [atlas, colors, entries, invalidate, logoLoader]);

  useEffect(() => {
    return () => {
      atlas?.dispose();
    };
  }, [atlas]);

  return atlas;
};
