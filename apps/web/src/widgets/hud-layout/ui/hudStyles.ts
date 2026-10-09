import type { ViewportClassValue } from '@/shared/lib/viewport';

import { cn } from '@/shared/lib/cn';

const HUD_ROOT_BASE_CLASS_NAME = 'relative isolate flex-1';

export const HUD_SIDE_PADDING_CLASS_NAME = 'pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]';

export const HUD_SIDE_MARGIN_CLASS_NAME = 'mr-[max(0.75rem,env(safe-area-inset-right))] ml-[max(0.75rem,env(safe-area-inset-left))]';

export type HudZonePaddingValue = 'edge' | 'flush-edge' | 'zone';

export const HUD_ZONE_CLASS_NAME = 'flex min-h-0 flex-col overflow-y-auto @container';

export const HUD_ZONE_PADDING_CLASS_NAMES: Readonly<Record<HudZonePaddingValue, string>> = {
  'edge': 'px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
  'flush-edge': 'px-0 pt-0 pb-[env(safe-area-inset-bottom)]',
  'zone': 'p-4',
};

export const HUD_DESKTOP_OVERLAY_CLASS_NAME = [
  'pointer-events-none absolute inset-0 flex gap-4 pt-4',
  'pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]',
].join(' ');

export const HUD_DESKTOP_SIDE_COLUMN_CLASS_NAME = 'flex min-h-0 w-[clamp(18rem,24vw,24rem)] shrink-0 flex-col gap-4';

export const HUD_DESKTOP_KPI_ZONE_CLASS_NAME = 'min-h-48 max-h-[45%]';

export const HUD_DESKTOP_TRACKER_ZONE_CLASS_NAME = cn('mt-auto', HUD_DESKTOP_KPI_ZONE_CLASS_NAME);

export const HUD_DESKTOP_CENTER_COLUMN_CLASS_NAME = 'flex min-h-0 min-w-0 flex-1 items-start justify-center';

export const HUD_DESKTOP_PANEL_ZONE_CLASS_NAME = 'max-h-full w-full max-w-4xl';

export const HUD_DESKTOP_INSPECTOR_ZONE_CLASS_NAME = 'min-h-56 max-h-[calc(55%-0.5rem)]';

export const HUD_DESKTOP_LISTS_ZONE_CLASS_NAME = 'mt-auto min-h-48 max-h-[calc(45%-0.5rem)]';

export const HUD_TABLET_KPI_ZONE_CLASS_NAME = 'min-h-28';

export const HUD_TABLET_PANEL_ZONE_CLASS_NAME = 'max-h-full';

export const HUD_TABLET_MAIN_CLASS_NAME = 'flex min-h-0 flex-1 flex-col';

export const HUD_TABLET_BOTTOM_ZONE_CLASS_NAME = 'sticky bottom-0 z-10 max-h-[45dvh] shrink-0';

export const HUD_PHONE_MAIN_CLASS_NAME = cn(
  'mt-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] max-h-full',
  HUD_SIDE_MARGIN_CLASS_NAME,
);

export const HUD_ROOT_CLASS_NAMES: Readonly<Record<ViewportClassValue, string>> = {
  desktop: cn(HUD_ROOT_BASE_CLASS_NAME, 'overflow-hidden'),
  phone: cn(HUD_ROOT_BASE_CLASS_NAME, 'flex flex-col'),
  tablet: cn(HUD_ROOT_BASE_CLASS_NAME, 'flex flex-col gap-3 overflow-x-hidden py-3', HUD_SIDE_PADDING_CLASS_NAME),
};
