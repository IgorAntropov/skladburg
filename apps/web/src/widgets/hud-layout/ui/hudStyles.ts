import type { ViewportClassValue } from '@/shared/lib/viewport';

import { cn } from '@/shared/lib/cn';

const HUD_ROOT_BASE_CLASS_NAME = 'relative isolate flex-1';

export const HUD_SIDE_PADDING_CLASS_NAME = 'pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]';

export const HUD_SIDE_MARGIN_CLASS_NAME = 'mr-[max(0.75rem,env(safe-area-inset-right))] ml-[max(0.75rem,env(safe-area-inset-left))]';

export const HUD_SCENE_CLASS_NAME = 'absolute inset-0 -z-10';

export const HUD_EDGE_SURFACE_CLASS_NAME = 'border-line bg-panel text-on-panel shadow-panel backdrop-blur-panel';

export const HUD_ROOT_CLASS_NAMES: Readonly<Record<ViewportClassValue, string>> = {
  desktop: cn(HUD_ROOT_BASE_CLASS_NAME, 'overflow-hidden'),
  phone: cn(HUD_ROOT_BASE_CLASS_NAME, 'flex flex-col'),
  tablet: cn(HUD_ROOT_BASE_CLASS_NAME, 'flex flex-col gap-3 overflow-x-hidden py-3', HUD_SIDE_PADDING_CLASS_NAME),
};
