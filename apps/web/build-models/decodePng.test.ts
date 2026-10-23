import {
  describe,
  expect,
  it,
} from 'vitest';

import { decodePng } from './decodePng.ts';
import {
  createPatternPixels,
  createPng,
} from './pngFixtures.ts';

const WIDTH = 7;

const HEIGHT = 6;

const toRgba = (pixels: Uint8Array, channels: number): number[] => {
  const rgba: number[] = [];

  for (let pixel = 0; pixel < pixels.length / channels; pixel += 1) {
    rgba.push(
      pixels[pixel * channels] ?? 0,
      pixels[pixel * channels + 1] ?? 0,
      pixels[pixel * channels + 2] ?? 0,
      channels === 4 ? (pixels[pixel * channels + 3] ?? 0) : 255,
    );
  }

  return rgba;
};

describe('decodePng', () => {
  it.each([0, 1, 2, 3, 4])('decodes rows filtered with filter %i', (filterType) => {
    const pixels = createPatternPixels(WIDTH, HEIGHT, 4);
    const image = decodePng(createPng({ channels: 4, filters: [filterType], height: HEIGHT, pixels, width: WIDTH }));

    expect(image.width).toBe(WIDTH);
    expect(image.height).toBe(HEIGHT);
    expect([...image.data]).toEqual(toRgba(pixels, 4));
  });

  it('decodes an image whose rows use all five filters in turn', () => {
    const pixels = createPatternPixels(WIDTH, HEIGHT, 4);
    const image = decodePng(createPng({ channels: 4, filters: [0, 1, 2, 3, 4], height: HEIGHT, pixels, width: WIDTH }));

    expect([...image.data]).toEqual(toRgba(pixels, 4));
  });

  it.each([0, 1, 2, 3, 4])('decodes RGB rows filtered with filter %i and fills opaque alpha', (filterType) => {
    const pixels = createPatternPixels(WIDTH, HEIGHT, 3);
    const image = decodePng(createPng({ channels: 3, filters: [filterType], height: HEIGHT, pixels, width: WIDTH }));

    expect([...image.data]).toEqual(toRgba(pixels, 3));
  });

  it('rejects a wrong signature', () => {
    const png = createPng({ height: 2, width: 2 });

    png[1] = 0;

    expect(() => decodePng(png)).toThrow('PNG: wrong signature');
  });

  it('rejects a bit depth other than 8', () => {
    expect(() => decodePng(createPng({ bitDepth: 16, height: 2, width: 2 }))).toThrow('PNG: bit depth 16 is not supported');
  });

  it('rejects color types other than RGB and RGBA', () => {
    expect(() => decodePng(createPng({ colorType: 3, height: 2, width: 2 }))).toThrow('PNG: color type 3 is not supported');
  });

  it('rejects an interlaced image', () => {
    expect(() => decodePng(createPng({ height: 2, interlace: 1, width: 2 }))).toThrow('PNG: interlaced images are not supported');
  });

  it('rejects a file without the header chunk', () => {
    expect(() => decodePng(createPng({ hasHeader: false, height: 2, width: 2 }))).toThrow('PNG: header is missing');
  });

  it('rejects a file without image data', () => {
    expect(() => decodePng(createPng({ hasData: false, height: 2, width: 2 }))).toThrow('PNG: image data is missing');
  });

  it('rejects an unknown filter type', () => {
    expect(() => decodePng(createPng({ filters: [7], height: 2, width: 2 }))).toThrow('PNG: unknown filter 7');
  });

  it('rejects image data of the wrong size', () => {
    const png = createPng({ height: 4, width: 4 });

    new DataView(png.buffer).setUint32(16, 9);

    expect(() => decodePng(png)).toThrow('PNG: image data length');
  });

  it('rejects a truncated file', () => {
    const png = createPng({ height: 4, width: 4 });

    expect(() => decodePng(png.subarray(0, 50))).toThrow('PNG: chunk IDAT is truncated');
  });
});
