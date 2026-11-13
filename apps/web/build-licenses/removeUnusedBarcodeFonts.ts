import type { Plugin } from 'vite';

import { hasEntryModule } from '../build-budget/isEntryModule.ts';

const BARCODE_MODULE = 'node_modules/@bwip-js/generic/dist/bwip-js-gen.mjs';
const EMBEDDED_FONT = /^FontLib\.loadFont\("OCR-[AB]", \d+, \d+, "[\w+/=]+"\);\r?$/gmu;

export const removeUnusedBarcodeFonts = (): Plugin => ({
  enforce: 'pre',
  name: 'skladburg:remove-unused-barcode-fonts',
  transform(code, id) {
    if (!hasEntryModule([id], BARCODE_MODULE)) {
      return undefined;
    }
    const fonts = Array.from(code.matchAll(EMBEDDED_FONT));
    if (fonts.length !== 2) {
      this.error('Unexpected embedded OCR fonts in the barcode package');
    }
    return { code: code.replace(EMBEDDED_FONT, ''), map: null };
  },
});
