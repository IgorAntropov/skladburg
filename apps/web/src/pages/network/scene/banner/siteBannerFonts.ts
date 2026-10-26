interface FontProbeValue {
  sample: string;
  spec: string;
}

const FONT_PROBES: readonly FontProbeValue[] = [
  { sample: 'АЯЗа', spec: '800 64px Manrope' },
  { sample: 'NF', spec: '800 64px Manrope' },
  { sample: '1234567890', spec: '600 64px Manrope' },
];

const hasFontSet = (): boolean => typeof document !== 'undefined' && 'fonts' in document;

export const isSiteBannerFontReady = (): boolean => (
  !hasFontSet() || FONT_PROBES.every(({ sample, spec }) => document.fonts.check(spec, sample))
);

export const loadSiteBannerFonts = async (): Promise<void> => {
  if (!hasFontSet()) {
    return;
  }

  await Promise.allSettled(FONT_PROBES.map(async ({ sample, spec }) => document.fonts.load(spec, sample)));
};
