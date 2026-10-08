import type { RgbaColorValue } from './RgbaColorValue';

import { compositeOver } from './compositeOver';
import { relativeLuminance } from './relativeLuminance';

export const contrastRatio = (
  foreground: RgbaColorValue,
  background: RgbaColorValue,
): number => {
  if (background.alpha < 1) {
    throw new Error('contrastRatio requires an opaque background');
  }

  const visibleForeground = compositeOver(foreground, background);
  const foregroundLuminance = relativeLuminance(visibleForeground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
};
