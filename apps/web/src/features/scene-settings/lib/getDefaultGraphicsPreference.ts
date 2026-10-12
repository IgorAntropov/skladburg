import type { ViewportClassValue } from '@/shared/lib/viewport';

import type { GraphicsPreferenceValue } from '../model/graphicsPreference';

export const getDefaultGraphicsPreference = (viewportClass: ViewportClassValue): GraphicsPreferenceValue => {
  return viewportClass === 'phone' ? 'off' : 'auto';
};
