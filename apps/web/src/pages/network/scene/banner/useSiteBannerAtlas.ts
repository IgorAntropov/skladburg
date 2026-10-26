import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';

import { useWorldPalette } from '@/shared/3d';

import type { ISiteBannerAtlas } from './createSiteBannerAtlas';
import type { SiteBannerEntryValue } from './siteBannerEntry';

import { createSiteBannerAtlas } from './createSiteBannerAtlas';
import { readSiteBannerColors } from './siteBannerColors';
import {
  isSiteBannerFontReady,
  loadSiteBannerFonts,
} from './siteBannerFonts';

export const useSiteBannerAtlas = (entries: readonly SiteBannerEntryValue[]): ISiteBannerAtlas | undefined => {
  const palette = useWorldPalette();
  const maxAnisotropy = useThree(state => state.gl.capabilities.getMaxAnisotropy());
  const invalidate = useThree(state => state.invalidate);

  const colors = useMemo(() => readSiteBannerColors(palette), [palette]);
  const atlas = useMemo(
    (): ISiteBannerAtlas | undefined => entries.length === 0 ? undefined : createSiteBannerAtlas(entries, maxAnisotropy),
    [entries, maxAnisotropy],
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
    return () => {
      atlas?.dispose();
    };
  }, [atlas]);

  return atlas;
};
