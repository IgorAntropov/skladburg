import type { EncodedAvatarValue } from '../model/encodedAvatarValue';

import {
  AVATAR_MAX_ENCODED_BYTES,
  AVATAR_MAX_SOURCE_BYTES,
  AVATAR_SIZE_PX,
} from '../model/avatarImageLimits';
import { AvatarImageError } from './AvatarImageError';
import { computeCenterCrop } from './computeCenterCrop';

type AvatarEncodedMediaTypeValue = 'image/jpeg' | 'image/webp';

interface EncodedBlobValue {
  blob: Blob;
  kind: 'encoded';
  mediaType: AvatarEncodedMediaTypeValue;
}

interface EncodingFormatValue {
  mediaType: AvatarEncodedMediaTypeValue;
  qualities: readonly number[];
}

type EncodingOutcomeValue
  = | EncodedBlobValue
    | { kind: 'too-large' }
    | { kind: 'unsupported' };

const WEBP_FORMAT: EncodingFormatValue = { mediaType: 'image/webp', qualities: [0.82, 0.68, 0.54] };
const JPEG_FORMAT: EncodingFormatValue = { mediaType: 'image/jpeg', qualities: [0.85, 0.7, 0.55] };
const BACKGROUND_COLOR = '#ffffff';

const decodeImage = async (file: File): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  catch {
    throw new AvatarImageError('avatar.decodeFailed');
  }
};

const drawSquare = (bitmap: ImageBitmap): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (context === null) {
    throw new AvatarImageError('avatar.decodeFailed');
  }

  const { size, sx, sy } = computeCenterCrop(bitmap.width, bitmap.height);

  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

  return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement, mediaType: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, mediaType, quality);
  });

const encodeStep = async (
  canvas: HTMLCanvasElement,
  format: EncodingFormatValue,
  step: number,
): Promise<EncodingOutcomeValue> => {
  const quality = format.qualities[step];

  if (quality === undefined) {
    return { kind: 'too-large' };
  }

  const blob = await canvasToBlob(canvas, format.mediaType, quality);

  if (blob?.type !== format.mediaType) {
    return { kind: 'unsupported' };
  }

  if (blob.size <= AVATAR_MAX_ENCODED_BYTES) {
    return { blob, kind: 'encoded', mediaType: format.mediaType };
  }

  return encodeStep(canvas, format, step + 1);
};

const encodeSquare = async (canvas: HTMLCanvasElement): Promise<EncodedBlobValue> => {
  const webpOutcome = await encodeStep(canvas, WEBP_FORMAT, 0);
  const outcome = webpOutcome.kind === 'unsupported' ? await encodeStep(canvas, JPEG_FORMAT, 0) : webpOutcome;

  if (outcome.kind === 'encoded') {
    return outcome;
  }

  throw new AvatarImageError(outcome.kind === 'too-large' ? 'avatar.tooLarge' : 'avatar.decodeFailed');
};

export const encodeAvatarImage = async (file: File): Promise<EncodedAvatarValue> => {
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    throw new AvatarImageError('avatar.sourceTooLarge');
  }

  const bitmap = await decodeImage(file);
  let canvas: HTMLCanvasElement;

  try {
    canvas = drawSquare(bitmap);
  }
  finally {
    bitmap.close();
  }

  const { blob, mediaType } = await encodeSquare(canvas);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return { bytes, mediaType };
};
