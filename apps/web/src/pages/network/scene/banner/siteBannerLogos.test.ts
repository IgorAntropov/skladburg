import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  LoadSiteBannerLogoImage,
  SiteBannerLogoImageValue,
} from './siteBannerLogos';

import {
  createSiteBannerLogoLoader,
  listSiteBannerLogoPaths,
} from './siteBannerLogos';
import { createTestEntry } from './siteBannerTestSupport';

const BASE_URL = 'https://example.org/skladburg/';

const createLogo = (width = 124, height = 76): SiteBannerLogoImageValue => ({
  height,
  image: { close: () => undefined } as unknown as CanvasImageSource,
  width,
});

const createDeferred = (): {
  promise: Promise<SiteBannerLogoImageValue>;
  reject: (error: Error) => void;
  resolve: (logo: SiteBannerLogoImageValue) => void;
} => {
  let resolve: (logo: SiteBannerLogoImageValue) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<SiteBannerLogoImageValue>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

describe('createSiteBannerLogoLoader', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('asks for the file under the base url of the app, sub path included', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>(() => Promise.resolve(createLogo()));
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await loader.load(['logos/supplier-1-light.svg']);

    expect(loadImage).toHaveBeenCalledExactlyOnceWith('https://example.org/skladburg/logos/supplier-1-light.svg');
  });

  it('keeps an absolute address and a data image as they are', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>(() => Promise.resolve(createLogo()));
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await loader.load(['https://cdn.example.net/a.svg', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=']);

    expect(loadImage.mock.calls.map(call => call[0])).toEqual([
      'https://cdn.example.net/a.svg',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    ]);
  });

  it('gives the loaded picture by its path and nothing before the load', async () => {
    const logo = createLogo(140, 76);
    const loader = createSiteBannerLogoLoader(() => Promise.resolve(logo), BASE_URL);

    expect(loader.peek('logos/a.svg')).toBeUndefined();

    await loader.load(['logos/a.svg']);

    expect(loader.peek('logos/a.svg')).toBe(logo);
    expect(loader.peek('logos/b.svg')).toBeUndefined();
  });

  it('loads a path once however many times and whenever it is asked', async () => {
    const deferred = createDeferred();
    const loadImage = vi.fn<LoadSiteBannerLogoImage>(() => deferred.promise);
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    const first = loader.load(['logos/a.svg', 'logos/a.svg']);
    const second = loader.load(['logos/a.svg']);

    deferred.resolve(createLogo());
    await Promise.all([first, second]);
    await loader.load(['logos/a.svg']);

    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('skips empty paths', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>(() => Promise.resolve(createLogo()));
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await loader.load(['', 'logos/a.svg', '']);

    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('resolves, gives no picture and writes a log when the load fails, then tries again on the next ask', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(createLogo());
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await expect(loader.load(['logos/a.svg'])).resolves.toBeUndefined();

    expect(loader.peek('logos/a.svg')).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith('> SiteBannerLogos -> load:', expect.objectContaining({ path: 'logos/a.svg' }));

    await loader.load(['logos/a.svg']);

    expect(loadImage).toHaveBeenCalledTimes(2);
    expect(loader.peek('logos/a.svg')).toBeDefined();
  });

  it('treats a synchronous throw of the image loader as a failure too', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>(() => {
      throw new Error('sync');
    });
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await loader.load(['logos/a.svg']);
    await loader.load(['logos/a.svg']);

    expect(loadImage).toHaveBeenCalledTimes(2);
    expect(loader.peek('logos/a.svg')).toBeUndefined();
  });

  it('refuses a picture with no size and forgets it', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>()
      .mockResolvedValueOnce(createLogo(0, 76))
      .mockResolvedValueOnce(createLogo(124, 0))
      .mockResolvedValueOnce(createLogo());
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await loader.load(['logos/a.svg']);

    expect(loader.peek('logos/a.svg')).toBeUndefined();

    await loader.load(['logos/a.svg']);

    expect(loader.peek('logos/a.svg')).toBeUndefined();

    await loader.load(['logos/a.svg']);

    expect(loadImage).toHaveBeenCalledTimes(3);
    expect(loader.peek('logos/a.svg')).toBeDefined();
  });

  it('does not ask for a path of a scheme that is not allowed', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>(() => Promise.resolve(createLogo()));
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await loader.load(['javascript:alert(1)', 'file:///etc/passwd']);

    expect(loadImage).not.toHaveBeenCalled();
    expect(loader.peek('javascript:alert(1)')).toBeUndefined();
  });

  it('lets one failure go without stopping the other paths', async () => {
    const loadImage = vi.fn<LoadSiteBannerLogoImage>(url => (
      url.endsWith('bad.svg') ? Promise.reject(new Error('bad')) : Promise.resolve(createLogo())
    ));
    const loader = createSiteBannerLogoLoader(loadImage, BASE_URL);

    await loader.load(['logos/bad.svg', 'logos/good.svg']);

    expect(loader.peek('logos/good.svg')).toBeDefined();
    expect(loader.peek('logos/bad.svg')).toBeUndefined();
  });
});

describe('listSiteBannerLogoPaths', () => {
  it('lists each non-empty path of the entries once', () => {
    const paths = listSiteBannerLogoPaths([
      createTestEntry('a', 'customer', { index: '1', letters: 'Зак' }, 'logos/a.svg'),
      createTestEntry('b', 'supplier', { index: '1', letters: 'Пос' }, ''),
      createTestEntry('c', 'supplier', { index: '2', letters: 'Пос' }, 'logos/a.svg'),
      createTestEntry('d', 'carrier', { index: '1', letters: 'Пер' }, 'logos/d.svg'),
    ]);

    expect(paths).toEqual(['logos/a.svg', 'logos/d.svg']);
  });
});
