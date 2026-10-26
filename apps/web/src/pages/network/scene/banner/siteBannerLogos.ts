import { resolveOrganizationLogoUrl } from '@/entities/organization';
import { getAppBaseUrl } from '@/shared/routing';

import type { SiteBannerEntryValue } from './siteBannerEntry';

export interface ISiteBannerLogoLoader {
  load: (paths: readonly string[]) => Promise<void>;
  peek: (path: string) => SiteBannerLogoImageValue | undefined;
}

export type LoadSiteBannerLogoImage = (url: string) => Promise<SiteBannerLogoImageValue>;

export interface SiteBannerLogoImageValue {
  height: number;
  image: CanvasImageSource;
  width: number;
}

export const createSiteBannerLogoLoader = (
  loadImage: LoadSiteBannerLogoImage,
  baseUrl: string | URL,
): ISiteBannerLogoLoader => {
  const loadings = new Map<string, Promise<void>>();
  const loadedLogos = new Map<string, SiteBannerLogoImageValue>();

  const readLogo = async (path: string, url: string): Promise<SiteBannerLogoImageValue | undefined> => {
    try {
      const logo = await loadImage(url);

      if (!(logo.width > 0) || !(logo.height > 0)) {
        throw new Error(`The site banner logo ${url} has no size`);
      }

      return logo;
    }
    catch (error: unknown) {
      console.log('> SiteBannerLogos -> load:', { error, path });

      return undefined;
    }
  };

  const loadOne = (path: string): Promise<void> => {
    const cached = loadings.get(path);

    if (cached !== undefined) {
      return cached;
    }

    const url = resolveOrganizationLogoUrl(path, baseUrl);

    if (url === undefined) {
      console.log('> SiteBannerLogos -> load:', { path, reason: 'unusable path' });

      return Promise.resolve();
    }

    const loading = readLogo(path, url).then((logo) => {
      if (logo === undefined) {
        loadings.delete(path);

        return;
      }

      loadedLogos.set(path, logo);
    });

    loadings.set(path, loading);

    return loading;
  };

  const load = async (paths: readonly string[]): Promise<void> => {
    await Promise.all([...new Set(paths)].filter(path => path !== '').map(loadOne));
  };

  const peek = (path: string): SiteBannerLogoImageValue | undefined => loadedLogos.get(path);

  return { load, peek };
};

const waitForImageLoad = async (image: HTMLImageElement): Promise<void> => new Promise((resolve, reject) => {
  const rejectLoad = (): void => {
    reject(new Error(`Logo image failed to load: ${image.src}`));
  };

  if (image.complete) {
    if (image.naturalWidth > 0) {
      resolve();
    }
    else {
      rejectLoad();
    }

    return;
  }

  image.addEventListener('load', () => {
    resolve();
  }, { once: true });
  image.addEventListener('error', rejectLoad, { once: true });
});

export const loadSiteBannerLogoImage: LoadSiteBannerLogoImage = async (url) => {
  const image = new Image();

  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = url;

  await image.decode().catch(async () => waitForImageLoad(image));

  return { height: image.naturalHeight, image, width: image.naturalWidth };
};

export const listSiteBannerLogoPaths = (entries: readonly SiteBannerEntryValue[]): string[] => [
  ...new Set(entries.map(entry => entry.logoPath).filter(path => path !== '')),
];

let sharedLoader: ISiteBannerLogoLoader | undefined;

const readSharedLoader = (): ISiteBannerLogoLoader => {
  sharedLoader ??= createSiteBannerLogoLoader(loadSiteBannerLogoImage, getAppBaseUrl());

  return sharedLoader;
};

export const siteBannerLogoLoader: ISiteBannerLogoLoader = {
  load: async (paths) => {
    await readSharedLoader().load(paths);
  },
  peek: path => readSharedLoader().peek(path),
};
