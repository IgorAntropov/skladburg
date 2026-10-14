import type { ShadowMapSizeValue } from '@/shared/3d';
import type { ViewportClassValue } from '@/shared/lib/viewport';

export const SCENE_SHADOW_MAP_SIZE: Readonly<Record<ViewportClassValue, ShadowMapSizeValue>> = {
  desktop: 4096,
  phone: 2048,
  tablet: 2048,
};
