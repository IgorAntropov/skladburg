import type { ReaderOptions } from 'zxing-wasm/reader';

import { readBarcodes } from 'zxing-wasm/reader';

import { toCameraScan } from './cameraCodes';

const OPTIONS = {
  formats: ['Code128', 'DataMatrix', 'EANUPC', 'QRCode'],
  maxNumberOfSymbols: 4,
  textMode: 'Plain',
} satisfies ReaderOptions;

export const readCameraCode = async (image: ImageData): Promise<string | undefined> => {
  const results = await readBarcodes(image, OPTIONS);
  let qr: string | undefined;
  for (const result of results) {
    const code = toCameraScan(result);
    if (code !== undefined) {
      if (result.symbology !== 'QRCode') {
        return code;
      }
      qr ??= code;
    }
  }
  return qr;
};
