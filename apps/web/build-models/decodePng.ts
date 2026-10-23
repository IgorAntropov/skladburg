import { inflateSync } from 'node:zlib';

export interface PngImageValue {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

export const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const COLOR_TYPE_RGB = 2;

const COLOR_TYPE_RGBA = 6;

const BITS_PER_CHANNEL = 8;

const OUTPUT_CHANNELS = 4;

const OPAQUE = 255;

const CHUNK_OVERHEAD_BYTES = 12;

const IHDR_BYTES = 13;

const createError = (reason: string): Error => new Error(`PNG: ${reason}`);

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

const predict = (filterType: number, left: number, up: number, upLeft: number): number => {
  switch (filterType) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4:
      return getPaeth(left, up, upLeft);
    default:
      throw createError(`unknown filter ${String(filterType)}`);
  }
};

const unfilter = (raw: Uint8Array, width: number, height: number, channels: number): Uint8Array => {
  const rowBytes = width * channels;
  const output = new Uint8Array(rowBytes * height);

  for (let row = 0; row < height; row += 1) {
    const filterType = raw[row * (rowBytes + 1)] ?? 0;
    const sourceStart = row * (rowBytes + 1) + 1;
    const targetStart = row * rowBytes;

    for (let byte = 0; byte < rowBytes; byte += 1) {
      const filtered = raw[sourceStart + byte] ?? 0;
      const left = byte >= channels ? (output[targetStart + byte - channels] ?? 0) : 0;
      const up = row > 0 ? (output[targetStart - rowBytes + byte] ?? 0) : 0;
      const upLeft = row > 0 && byte >= channels ? (output[targetStart - rowBytes + byte - channels] ?? 0) : 0;
      const predictor = predict(filterType, left, up, upLeft);

      output[targetStart + byte] = (filtered + predictor) & OPAQUE;
    }
  }

  return output;
};

const inflateData = (chunks: readonly Uint8Array[]): Uint8Array => {
  try {
    return inflateSync(Buffer.concat(chunks));
  }
  catch {
    throw createError('image data is corrupted');
  }
};

export const decodePng = (bytes: Uint8Array): PngImageValue => {
  const isSignatureValid = bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, index) => bytes[index] === value);

  if (!isSignatureValid) {
    throw createError('wrong signature');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataChunks: Uint8Array[] = [];
  let header: undefined | { channels: number; height: number; width: number };
  let offset = PNG_SIGNATURE.length;
  let isEnded = false;

  while (!isEnded && offset + CHUNK_OVERHEAD_BYTES <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const start = offset + 8;
    const end = start + length;

    if (end + 4 > bytes.length) {
      throw createError(`chunk ${type} is truncated`);
    }

    if (type === 'IHDR') {
      if (length !== IHDR_BYTES) {
        throw createError('header has a wrong length');
      }

      const bitDepth = bytes[start + 8];
      const colorType = bytes[start + 9];
      const interlace = bytes[start + 12];

      if (bitDepth !== BITS_PER_CHANNEL) {
        throw createError(`bit depth ${String(bitDepth)} is not supported`);
      }

      if (colorType !== COLOR_TYPE_RGB && colorType !== COLOR_TYPE_RGBA) {
        throw createError(`color type ${String(colorType)} is not supported`);
      }

      if (interlace !== 0) {
        throw createError('interlaced images are not supported');
      }

      header = {
        channels: colorType === COLOR_TYPE_RGBA ? OUTPUT_CHANNELS : 3,
        height: view.getUint32(start + 4),
        width: view.getUint32(start),
      };
    }

    if (type === 'IDAT') {
      dataChunks.push(bytes.subarray(start, end));
    }

    isEnded = type === 'IEND';
    offset = end + 4;
  }

  if (header === undefined) {
    throw createError('header is missing');
  }

  if (dataChunks.length === 0) {
    throw createError('image data is missing');
  }

  const raw = inflateData(dataChunks);
  const expectedLength = (header.width * header.channels + 1) * header.height;

  if (raw.length !== expectedLength) {
    throw createError(`image data length ${String(raw.length)} does not match ${String(expectedLength)}`);
  }

  const pixels = unfilter(raw, header.width, header.height, header.channels);
  const data = new Uint8ClampedArray(header.width * header.height * OUTPUT_CHANNELS);

  for (let pixel = 0; pixel < header.width * header.height; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      data[pixel * OUTPUT_CHANNELS + channel] = pixels[pixel * header.channels + channel] ?? 0;
    }

    data[pixel * OUTPUT_CHANNELS + 3] = header.channels === OUTPUT_CHANNELS ? (pixels[pixel * header.channels + 3] ?? OPAQUE) : OPAQUE;
  }

  return { data, height: header.height, width: header.width };
};
