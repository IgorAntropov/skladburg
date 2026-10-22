type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

interface SignatureSegmentValue {
  bytes: readonly number[];
  offset: number;
}

const SIGNATURES: Readonly<Record<ImageMediaType, readonly SignatureSegmentValue[]>> = {
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF], offset: 0 }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 }],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  ],
};

const isImageMediaType = (mediaType: string): mediaType is ImageMediaType => Object.hasOwn(SIGNATURES, mediaType);

const hasSegment = (image: Uint8Array, segment: SignatureSegmentValue): boolean =>
  image.length >= segment.offset + segment.bytes.length
  && segment.bytes.every((byte, index) => image[segment.offset + index] === byte);

export const isImageSignatureMatching = (image: Uint8Array, mediaType: string): boolean =>
  isImageMediaType(mediaType) && SIGNATURES[mediaType].every(segment => hasSegment(image, segment));
