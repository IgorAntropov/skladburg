import type { Page } from '@playwright/test';

import type { YardPlateCornersValue } from './yard-marking-scene-probe.ts';

export interface YardPlateRasterValue {
  contrast: number;
  glyphSlots: boolean[];
  inkHeightCssPx: number;
  paperRatio: number;
  png: string;
}

interface YardPlateRasterInputValue {
  base64: string;
  corners: YardPlateCornersValue;
  cssHeight: number;
  cssWidth: number;
  expectedNumber: string | undefined;
}

const scanYardPlateRaster = async ({
  base64, corners, cssHeight, cssWidth, expectedNumber,
}: YardPlateRasterInputValue): Promise<YardPlateRasterValue> => {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const surface = document.createElement('canvas');
  surface.width = image.naturalWidth;
  surface.height = image.naturalHeight;
  const source = surface.getContext('2d', { willReadFrequently: true });
  if (source === null) {
    throw new Error('The yard plate scan requires a raster context');
  }
  source.drawImage(image, 0, 0);
  const sourcePixels = source.getImageData(0, 0, surface.width, surface.height).data;
  const { bottomLeft, topLeft, topRight } = corners;
  const width = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
  const height = Math.hypot(topLeft.x - bottomLeft.x, topLeft.y - bottomLeft.y);
  const widthSteps = Math.max(1, Math.round(width * 4));
  const heightSteps = Math.max(1, Math.round(height * 4));
  const slots = expectedNumber?.length ?? 1;
  const textInset = 10 / 256;
  const slotWidth = (1 - 2 * textInset) / slots;
  const rowInset = expectedNumber === undefined ? 0.16 : 0.10;
  const inkHits = new Uint16Array(slots);
  const firstInkRows = new Uint16Array(slots).fill(heightSteps);
  const lastInkRows = new Uint16Array(slots);
  const sample = document.createElement('canvas');
  sample.width = Math.max(1, Math.round(width * surface.width / cssWidth));
  sample.height = Math.max(1, Math.round(height * surface.height / cssHeight));
  const target = sample.getContext('2d');
  if (target === null) {
    throw new Error('The yard plate crop requires a raster context');
  }
  const crop = target.createImageData(sample.width, sample.height);

  const pixelIndex = (u: number, v: number): number => {
    const x = topLeft.x + u * (topRight.x - topLeft.x) + v * (bottomLeft.x - topLeft.x);
    const y = topLeft.y + u * (topRight.y - topLeft.y) + v * (bottomLeft.y - topLeft.y);
    return 4 * (Math.floor(x * surface.width / cssWidth) + Math.floor(y * surface.height / cssHeight) * surface.width);
  };
  const toLinear = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  let paper = 0;
  let sampleCount = 0;
  let lightLuma = 0;
  let darkLuma = 1;
  for (let y = 0; y < heightSteps; y += 1) {
    const v = (y + 0.5) / heightSteps;
    for (let x = 0; x < widthSteps; x += 1) {
      const u = (x + 0.5) / widthSteps;
      if (u < 0.05 || u > 0.95 || v < rowInset || v > 1 - rowInset) {
        continue;
      }
      sampleCount += 1;
      const index = pixelIndex(u, v);
      const red = sourcePixels[index] ?? 0;
      const green = sourcePixels[index + 1] ?? 0;
      const blue = sourcePixels[index + 2] ?? 0;
      const luma = toLinear(red) * 0.2126 + toLinear(green) * 0.7152 + toLinear(blue) * 0.0722;
      if (red >= 220 && green >= 213 && blue >= 195) {
        paper += 1;
        lightLuma = Math.max(lightLuma, luma);
      }
      if (red <= 112 && green <= 116 && blue <= 139 && blue >= red + 9) {
        const slot = Math.floor((u - textInset) / slotWidth);
        const withinSlot = (u - textInset) / slotWidth - slot;
        if (slot >= 0 && slot < slots && withinSlot >= 0.08 && withinSlot <= 0.92) {
          inkHits[slot] = (inkHits[slot] ?? 0) + 1;
          firstInkRows[slot] = Math.min(firstInkRows[slot] ?? heightSteps, y);
          lastInkRows[slot] = y;
          darkLuma = Math.min(darkLuma, luma);
        }
      }
    }
  }
  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const from = pixelIndex((x + 0.5) / sample.width, (y + 0.5) / sample.height);
      const to = 4 * (x + y * sample.width);
      crop.data[to] = sourcePixels[from] ?? 0;
      crop.data[to + 1] = sourcePixels[from + 1] ?? 0;
      crop.data[to + 2] = sourcePixels[from + 2] ?? 0;
      crop.data[to + 3] = 255;
    }
  }
  target.putImageData(crop, 0, 0);

  const glyphSlots = Array.from(inkHits, hits => hits >= 0.05 * heightSteps * slotWidth * widthSteps);
  const measuredHeights = glyphSlots.flatMap((isGlyph, index) => isGlyph
    ? [((lastInkRows[index] ?? 0) - (firstInkRows[index] ?? heightSteps) + 1) * height / heightSteps]
    : []);
  return {
    contrast: (lightLuma + 0.05) / (darkLuma + 0.05),
    glyphSlots,
    inkHeightCssPx: measuredHeights.length === 0 ? 0 : Math.min(...measuredHeights),
    paperRatio: paper / Math.max(1, sampleCount),
    png: sample.toDataURL('image/png').split(',')[1] ?? '',
  };
};

export const readYardPlateRaster = (
  page: Page, png: Buffer, corners: YardPlateCornersValue, viewport: { height: number; width: number }, expectedNumber: string | undefined,
): Promise<YardPlateRasterValue> => page.evaluate(scanYardPlateRaster, {
  base64: png.toString('base64'), corners, cssHeight: viewport.height, cssWidth: viewport.width, expectedNumber,
});
