import type { RgbaColorValue } from './RgbaColorValue';

import { MAX_CHANNEL } from './maxChannel';

const LINEAR_THRESHOLD = 0.04045;

const linearizeChannel = (channel: number): number => {
  const unit = channel / MAX_CHANNEL;

  return unit <= LINEAR_THRESHOLD
    ? unit / 12.92
    : ((unit + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (color: RgbaColorValue): number => {
  return (
    0.2126 * linearizeChannel(color.red)
    + 0.7152 * linearizeChannel(color.green)
    + 0.0722 * linearizeChannel(color.blue)
  );
};
