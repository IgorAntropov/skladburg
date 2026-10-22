export const PATTERN_WIDTH_PX = 600;

export const PATTERN_HEIGHT_PX = 400;

export const PATTERN_STRIPE_PX = 40;

export const createPatternPngBase64Script = (): string => `
(() => {
  const canvas = document.createElement('canvas');
  canvas.width = ${String(PATTERN_WIDTH_PX)};
  canvas.height = ${String(PATTERN_HEIGHT_PX)};
  const context = canvas.getContext('2d');
  const stripe = ${String(PATTERN_STRIPE_PX)};

  for (let row = 0; row < ${String(PATTERN_HEIGHT_PX / PATTERN_STRIPE_PX)}; row += 1) {
    for (let column = 0; column < ${String(PATTERN_WIDTH_PX / PATTERN_STRIPE_PX)}; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? '#2f6f8f' : '#e0b84a';
      context.fillRect(column * stripe, row * stripe, stripe, stripe);
    }
  }

  return canvas.toDataURL('image/png').split(',')[1];
})()
`;

export const HAS_HORIZONTAL_SCROLL_SCRIPT = 'document.documentElement.scrollWidth > document.documentElement.clientWidth';
