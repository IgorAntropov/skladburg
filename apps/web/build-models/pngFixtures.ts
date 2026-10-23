import {
  crc32,
  deflateSync,
} from 'node:zlib';

import { PNG_SIGNATURE } from './decodePng.ts';

export interface PngFixtureOptionsValue {
  bitDepth?: number;
  channels?: 3 | 4;
  colorType?: number;
  filters?: readonly number[];
  hasData?: boolean;
  hasHeader?: boolean;
  height: number;
  interlace?: number;
  pixels?: Uint8Array;
  width: number;
}

const getPaeth = (left: number, up: number, upLeft: number): number => {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
};

const createChunk = (type: string, payload: Uint8Array): Uint8Array => {
  const chunk = new Uint8Array(12 + payload.length);
  const view = new DataView(chunk.buffer);
  const typeBytes = new TextEncoder().encode(type);

  view.setUint32(0, payload.length);
  chunk.set(typeBytes, 4);
  chunk.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(chunk.subarray(4, 8 + payload.length)));

  return chunk;
};

export const createPatternPixels = (width: number, height: number, channels: number): Uint8Array => {
  const pixels = new Uint8Array(width * height * channels);

  for (let index = 0; index < pixels.length; index += 1) {
    const pixel = Math.floor(index / channels);

    pixels[index] = (Math.imul(pixel, 37) + (index % channels) * 91 + Math.floor(pixel / width) * 53) & 255;
  }

  return pixels;
};

const filterRows = (pixels: Uint8Array, width: number, height: number, channels: number, filters: readonly number[]): Uint8Array => {
  const rowBytes = width * channels;
  const filtered = new Uint8Array((rowBytes + 1) * height);

  for (let row = 0; row < height; row += 1) {
    const filterType = filters[row % filters.length] ?? 0;

    filtered[row * (rowBytes + 1)] = filterType;

    for (let byte = 0; byte < rowBytes; byte += 1) {
      const current = pixels[row * rowBytes + byte] ?? 0;
      const left = byte >= channels ? (pixels[row * rowBytes + byte - channels] ?? 0) : 0;
      const up = row > 0 ? (pixels[(row - 1) * rowBytes + byte] ?? 0) : 0;
      const upLeft = row > 0 && byte >= channels ? (pixels[(row - 1) * rowBytes + byte - channels] ?? 0) : 0;
      const predictors = [0, left, up, Math.floor((left + up) / 2), getPaeth(left, up, upLeft)];

      filtered[row * (rowBytes + 1) + 1 + byte] = (current - (predictors[filterType] ?? 0)) & 255;
    }
  }

  return filtered;
};

export const createPng = (options: PngFixtureOptionsValue): Uint8Array => {
  const {
    bitDepth = 8,
    channels = 4,
    filters = [0],
    hasData = true,
    hasHeader = true,
    height,
    interlace = 0,
    width,
  } = options;
  const colorType = options.colorType ?? (channels === 4 ? 6 : 2);
  const pixels = options.pixels ?? createPatternPixels(width, height, channels);
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);

  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = bitDepth;
  header[9] = colorType;
  header[12] = interlace;

  const parts = [
    Uint8Array.from(PNG_SIGNATURE),
    ...(hasHeader ? [createChunk('IHDR', header)] : []),
    ...(hasData ? [createChunk('IDAT', deflateSync(filterRows(pixels, width, height, channels, filters)))] : []),
    createChunk('IEND', new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }

  return png;
};
