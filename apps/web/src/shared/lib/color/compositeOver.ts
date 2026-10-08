import type { RgbaColorValue } from './RgbaColorValue';

export const compositeOver = (
  top: RgbaColorValue,
  bottom: RgbaColorValue,
): RgbaColorValue => {
  const alpha = top.alpha + bottom.alpha * (1 - top.alpha);

  if (alpha === 0) {
    return { alpha: 0, blue: 0, green: 0, red: 0 };
  }

  const mixChannel = (topChannel: number, bottomChannel: number): number => {
    return (
      topChannel * top.alpha
      + bottomChannel * bottom.alpha * (1 - top.alpha)
    ) / alpha;
  };

  return {
    alpha,
    blue: mixChannel(top.blue, bottom.blue),
    green: mixChannel(top.green, bottom.green),
    red: mixChannel(top.red, bottom.red),
  };
};
