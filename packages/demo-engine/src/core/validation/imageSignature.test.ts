import {
  describe,
  expect,
  it,
} from 'vitest';

import { isImageSignatureMatching } from './imageSignature';

const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const JPEG = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D]);

describe('isImageSignatureMatching', () => {
  it.each([
    ['image/webp', WEBP],
    ['image/jpeg', JPEG],
    ['image/png', PNG],
  ])('accepts the %s signature', (mediaType, image) => {
    expect(isImageSignatureMatching(image, mediaType)).toBe(true);
  });

  it.each([
    ['image/webp', PNG],
    ['image/webp', JPEG],
    ['image/jpeg', WEBP],
    ['image/jpeg', PNG],
    ['image/png', WEBP],
    ['image/png', JPEG],
  ])('rejects the %s type for bytes of another format', (mediaType, image) => {
    expect(isImageSignatureMatching(image, mediaType)).toBe(false);
  });

  it('rejects a RIFF container that is not WebP', () => {
    const wave = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]);

    expect(isImageSignatureMatching(wave, 'image/webp')).toBe(false);
  });

  it('rejects bytes shorter than the signature', () => {
    expect(isImageSignatureMatching(PNG.slice(0, 7), 'image/png')).toBe(false);
    expect(isImageSignatureMatching(WEBP.slice(0, 11), 'image/webp')).toBe(false);
    expect(isImageSignatureMatching(new Uint8Array(), 'image/jpeg')).toBe(false);
  });

  it.each(['', 'image/gif', 'image/svg+xml', 'toString', 'constructor'])('rejects the media type "%s"', (mediaType) => {
    expect(isImageSignatureMatching(JPEG, mediaType)).toBe(false);
  });
});
