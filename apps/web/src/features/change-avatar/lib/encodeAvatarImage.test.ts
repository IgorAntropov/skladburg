import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AvatarImageError } from './AvatarImageError';
import { encodeAvatarImage } from './encodeAvatarImage';

type BlobProducerValue = (type: string, quality: number) => Blob | null;

interface FakeBitmapValue {
  close: ReturnType<typeof vi.fn>;
  height: number;
  width: number;
}

interface FakeCanvasValue {
  getContext: () => FakeContextValue | null;
  height: number;
  toBlob: (callback: ToBlobCallback, type: string, quality: number) => void;
  width: number;
}

interface FakeContextValue {
  drawImage: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  fillStyle: string;
  imageSmoothingQuality: string;
}

type ToBlobCallback = (blob: Blob | null) => void;

const SOURCE_LIMIT_BYTES = 20 * 1024 * 1024;
const ENCODED_LIMIT_BYTES = 65536;

const createBlob = (type: string, size: number): Blob => new Blob([new Uint8Array(size).fill(7)], { type });

const createFile = (size = 1000): File => {
  const file = new File([new Uint8Array(4)], 'photo.jpg', { type: 'image/jpeg' });

  Object.defineProperty(file, 'size', { value: size });

  return file;
};

const createBitmap = (width: number, height: number): FakeBitmapValue => ({ close: vi.fn(), height, width });

const setupCanvas = (produceBlob: BlobProducerValue, hasContext = true): {
  canvas: FakeCanvasValue;
  context: FakeContextValue;
  toBlobCalls: [string, number][];
} => {
  const context: FakeContextValue = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    imageSmoothingQuality: '',
  };
  const toBlobCalls: [string, number][] = [];
  const canvas: FakeCanvasValue = {
    getContext: () => (hasContext ? context : null),
    height: 0,
    toBlob: (callback, type, quality) => {
      toBlobCalls.push([type, quality]);
      callback(produceBlob(type, quality));
    },
    width: 0,
  };
  vi.stubGlobal('document', { createElement: () => canvas });

  return { canvas, context, toBlobCalls };
};

const stubBitmap = (bitmap: FakeBitmapValue): ReturnType<typeof vi.fn> => {
  const createImageBitmapStub = vi.fn().mockResolvedValue(bitmap);

  vi.stubGlobal('createImageBitmap', createImageBitmapStub);

  return createImageBitmapStub;
};

const readErrorKey = async (file: File): Promise<string | undefined> => {
  try {
    await encodeAvatarImage(file);
  }
  catch (error) {
    return error instanceof AvatarImageError ? error.messageKey : undefined;
  }

  return undefined;
};

describe('encodeAvatarImage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects a source above the limit before decoding it', async () => {
    const decode = stubBitmap(createBitmap(10, 10));

    expect(await readErrorKey(createFile(SOURCE_LIMIT_BYTES + 1))).toBe('avatar.sourceTooLarge');
    expect(decode).not.toHaveBeenCalled();
  });

  it('accepts a source exactly at the limit', async () => {
    stubBitmap(createBitmap(10, 10));
    setupCanvas(type => createBlob(type, 100));

    expect(await readErrorKey(createFile(SOURCE_LIMIT_BYTES))).toBeUndefined();
  });

  it('reports a file the browser cannot decode', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('broken', 'InvalidStateError')));

    expect(await readErrorKey(createFile())).toBe('avatar.decodeFailed');
  });

  it('decodes with the orientation of the file', async () => {
    const decode = stubBitmap(createBitmap(10, 10));
    setupCanvas(type => createBlob(type, 100));
    const file = createFile();

    await encodeAvatarImage(file);

    expect(decode).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
  });

  it('draws the centered square of a landscape picture on a flat 256 px canvas and frees the bitmap', async () => {
    const bitmap = createBitmap(1600, 900);
    stubBitmap(bitmap);
    const { canvas, context } = setupCanvas(type => createBlob(type, 100));

    await encodeAvatarImage(createFile());

    expect(canvas.width).toBe(256);
    expect(canvas.height).toBe(256);
    expect(context.fillStyle).toBe('#ffffff');
    expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(bitmap, 350, 0, 900, 900, 0, 0, 256, 256);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('frees the bitmap when the canvas has no drawing context', async () => {
    const bitmap = createBitmap(100, 100);
    stubBitmap(bitmap);
    setupCanvas(type => createBlob(type, 100), false);

    expect(await readErrorKey(createFile())).toBe('avatar.decodeFailed');
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('encodes WebP with the first quality when the browser supports it', async () => {
    stubBitmap(createBitmap(300, 300));
    const { toBlobCalls } = setupCanvas(type => createBlob(type, 2000));

    const result = await encodeAvatarImage(createFile());

    expect(result.mediaType).toBe('image/webp');
    expect(result.bytes).toHaveLength(2000);
    expect(toBlobCalls).toEqual([['image/webp', 0.82]]);
  });

  it('falls back to JPEG when the browser returns another type for WebP', async () => {
    stubBitmap(createBitmap(300, 300));
    const { toBlobCalls } = setupCanvas(type => createBlob(type === 'image/webp' ? 'image/png' : type, 3000));

    const result = await encodeAvatarImage(createFile());

    expect(result.mediaType).toBe('image/jpeg');
    expect(result.bytes).toHaveLength(3000);
    expect(toBlobCalls).toEqual([['image/webp', 0.82], ['image/jpeg', 0.85]]);
  });

  it('falls back to JPEG when the browser returns nothing for WebP', async () => {
    stubBitmap(createBitmap(300, 300));
    const { toBlobCalls } = setupCanvas(type => (type === 'image/webp' ? null : createBlob(type, 3000)));

    const result = await encodeAvatarImage(createFile());

    expect(result.mediaType).toBe('image/jpeg');
    expect(toBlobCalls).toEqual([['image/webp', 0.82], ['image/jpeg', 0.85]]);
  });

  it('lowers the quality until the result fits', async () => {
    stubBitmap(createBitmap(300, 300));
    const { toBlobCalls } = setupCanvas((type, quality) => createBlob(type, quality > 0.7 ? ENCODED_LIMIT_BYTES + 1 : ENCODED_LIMIT_BYTES));

    const result = await encodeAvatarImage(createFile());

    expect(result.mediaType).toBe('image/webp');
    expect(result.bytes).toHaveLength(ENCODED_LIMIT_BYTES);
    expect(toBlobCalls).toEqual([['image/webp', 0.82], ['image/webp', 0.68]]);
  });

  it('lowers the quality of the JPEG fallback too', async () => {
    stubBitmap(createBitmap(300, 300));
    const { toBlobCalls } = setupCanvas((type, quality) => {
      if (type === 'image/webp') {
        return createBlob('image/png', 10);
      }

      return createBlob(type, quality > 0.8 ? ENCODED_LIMIT_BYTES + 1 : 500);
    });

    const result = await encodeAvatarImage(createFile());

    expect(result.mediaType).toBe('image/jpeg');
    expect(toBlobCalls).toEqual([['image/webp', 0.82], ['image/jpeg', 0.85], ['image/jpeg', 0.7]]);
  });

  it('reports a result that stays above the limit at every quality', async () => {
    stubBitmap(createBitmap(300, 300));
    const { toBlobCalls } = setupCanvas(type => createBlob(type, ENCODED_LIMIT_BYTES + 1));

    expect(await readErrorKey(createFile())).toBe('avatar.tooLarge');
    expect(toBlobCalls).toHaveLength(3);
  });
});
