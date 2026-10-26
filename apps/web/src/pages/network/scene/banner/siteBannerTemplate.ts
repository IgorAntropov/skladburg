import type { MonogramPartsValue } from '@/entities/organization';

export interface BannerTextBlockValue {
  baseline: number;
  capHeightPx: number;
  centerX: number;
  runs: readonly BannerTextRunValue[];
}

export interface BannerTextRunValue {
  fontSize: number;
  fontWeight: number;
  gapBeforePx: number;
  text: string;
}

export const SITE_BANNER_NEAR_WIDTH_PX = 256;

export const SITE_BANNER_NEAR_HEIGHT_PX = 128;

export const SITE_BANNER_FAR_SIZE_PX = 64;

export const SITE_BANNER_FONT_FAMILY = 'Manrope, \'Manrope Fallback\', Arial, sans-serif';

export const SITE_BANNER_PLATE_INSET_PX = 6;

export const SITE_BANNER_PLATE_RADIUS_PX = 18;

export const SITE_BANNER_FRAME_WIDTH_PX = 10;

export const SITE_BANNER_NEAR_GLYPH = {
  rimPx: 3,
  sizePx: 36,
  xPx: 202,
  yPx: 18,
} as const;

export const SITE_BANNER_FAR_GLYPH = {
  rimPx: 5,
  sizePx: 52,
  xPx: 6,
  yPx: 6,
} as const;

export const SITE_BANNER_FALLBACK_CIRCLE_RADIUS_PX = 16;

export const SITE_BANNER_LETTERS_WEIGHT = 800;

export const SITE_BANNER_INDEX_WEIGHT = 600;

export const SITE_BANNER_MAX_TEXT_WIDTH_PX = 142;

export const SITE_BANNER_LOGO_FIELD = {
  centerXPx: 122,
  centerYPx: 68,
  heightPx: 76,
  widthPx: 142,
} as const;

export const SITE_BANNER_SIZE_LADDER_PX: readonly number[] = Array.from(
  { length: 22 },
  (_, position) => 72 - position * 2,
);

const TEXT_CENTER_X_PX = SITE_BANNER_NEAR_WIDTH_PX / 2;

const TEXT_CENTER_Y_PX = 66;

const INDEX_SCALE = 0.6;

const INDEX_GAP_EM = 0.08;

const CAP_HEIGHT_EM = 0.72;

const UPPER_ADVANCE_EM = 0.76;

const WIDE_UPPER_ADVANCE_EM = 1;

const LOWER_ADVANCE_EM = 0.66;

const WIDE_LOWER_ADVANCE_EM = 0.9;

const DIGIT_ADVANCE_EM = 0.67;

const WIDE_UPPER_LETTERS: ReadonlySet<string> = new Set(['M', 'W', 'Ж', 'М', 'Ш', 'Щ', 'Ы', 'Ю']);

const WIDE_LOWER_LETTERS: ReadonlySet<string> = new Set(['m', 'w', 'ж', 'м', 'ф', 'ш', 'щ', 'ы', 'ю']);

const roundToHundredths = (value: number): number => Math.round(value * 100) / 100;

const isLowerLetter = (letter: string): boolean => (
  letter === letter.toLocaleLowerCase() && letter !== letter.toLocaleUpperCase()
);

const readLetterAdvanceEm = (letter: string): number => {
  if (isLowerLetter(letter)) {
    return WIDE_LOWER_LETTERS.has(letter) ? WIDE_LOWER_ADVANCE_EM : LOWER_ADVANCE_EM;
  }

  return WIDE_UPPER_LETTERS.has(letter) ? WIDE_UPPER_ADVANCE_EM : UPPER_ADVANCE_EM;
};

export const estimateMonogramWidth = (monogram: MonogramPartsValue, size: number): number => {
  const lettersWidth = Array.from(monogram.letters)
    .reduce((sum, letter) => sum + readLetterAdvanceEm(letter) * size, 0);
  const hasLetters = monogram.letters.length > 0;
  const indexSize = hasLetters ? size * INDEX_SCALE : size;
  const indexWidth = monogram.index.length * DIGIT_ADVANCE_EM * indexSize;
  const gapWidth = hasLetters && monogram.index.length > 0 ? size * INDEX_GAP_EM : 0;

  return lettersWidth + gapWidth + indexWidth;
};

const pickTextSize = (monogram: MonogramPartsValue): number => {
  const fittingSize = SITE_BANNER_SIZE_LADDER_PX.find(
    size => estimateMonogramWidth(monogram, size) <= SITE_BANNER_MAX_TEXT_WIDTH_PX,
  );

  return fittingSize ?? SITE_BANNER_SIZE_LADDER_PX.at(-1) ?? 0;
};

const buildTextRuns = (monogram: MonogramPartsValue, size: number): BannerTextRunValue[] => {
  const hasLetters = monogram.letters.length > 0;
  const runs: BannerTextRunValue[] = [];

  if (hasLetters) {
    runs.push({
      fontSize: size,
      fontWeight: SITE_BANNER_LETTERS_WEIGHT,
      gapBeforePx: 0,
      text: monogram.letters,
    });
  }

  if (monogram.index.length > 0) {
    runs.push({
      fontSize: hasLetters ? roundToHundredths(size * INDEX_SCALE) : size,
      fontWeight: hasLetters ? SITE_BANNER_INDEX_WEIGHT : SITE_BANNER_LETTERS_WEIGHT,
      gapBeforePx: hasLetters ? roundToHundredths(size * INDEX_GAP_EM) : 0,
      text: monogram.index,
    });
  }

  return runs;
};

export const readBannerTextBlock = (monogram: MonogramPartsValue): BannerTextBlockValue => {
  const size = pickTextSize(monogram);
  const capHeightPx = roundToHundredths(size * CAP_HEIGHT_EM);

  return {
    baseline: roundToHundredths(TEXT_CENTER_Y_PX + capHeightPx / 2),
    capHeightPx,
    centerX: TEXT_CENTER_X_PX,
    runs: buildTextRuns(monogram, size),
  };
};
