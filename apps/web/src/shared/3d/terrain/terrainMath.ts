const HISTOGRAM_BINS = 2048;

export const readNumber = (values: ArrayLike<number>, index: number): number => values[index] ?? 0;

export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export const smoothstep = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));

  return t * t * (3 - 2 * t);
};

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

export const findTopShareThreshold = (values: Float32Array, targetCount: number): number => {
  if (targetCount <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const histogram = new Uint32Array(HISTOGRAM_BINS);
  let eligibleCount = 0;

  for (const value of values) {
    if (value >= 0) {
      const bin = (value * HISTOGRAM_BINS) | 0;
      const safeBin = bin < HISTOGRAM_BINS ? bin : HISTOGRAM_BINS - 1;
      histogram[safeBin] = (histogram[safeBin] ?? 0) + 1;
      eligibleCount += 1;
    }
  }

  if (eligibleCount <= targetCount) {
    return 0;
  }

  let accumulated = 0;

  for (let bin = HISTOGRAM_BINS - 1; bin >= 0; bin -= 1) {
    accumulated += histogram[bin] ?? 0;

    if (accumulated >= targetCount) {
      return bin / HISTOGRAM_BINS;
    }
  }

  return 0;
};
