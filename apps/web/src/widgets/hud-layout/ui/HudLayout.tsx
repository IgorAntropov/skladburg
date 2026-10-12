import type { ReactElement } from 'react';

import type { ViewportClassValue } from '@/shared/lib/viewport';

import { cn } from '@/shared/lib/cn';
import { useViewportClass } from '@/shared/lib/viewport';

import type {
  HudLayoutProps,
  HudZonesProps,
} from '../lib/hudLayoutTypes';

import { DesktopHudLayout } from './DesktopHudLayout';
import {
  HUD_INTERACTIVE_CLASS_NAME,
  HUD_PASSTHROUGH_CLASS_NAME,
  HUD_ROOT_CLASS_NAMES,
} from './hudStyles';
import { PhoneHudLayout } from './PhoneHudLayout';
import { TabletHudLayout } from './TabletHudLayout';

const SCENE_CLASS_NAME = cn('absolute inset-0 -z-10', HUD_INTERACTIVE_CLASS_NAME);

const ZONES_LAYOUTS: Readonly<Record<ViewportClassValue, (props: HudZonesProps) => ReactElement>> = {
  desktop: DesktopHudLayout,
  phone: PhoneHudLayout,
  tablet: TabletHudLayout,
};

export const HudLayout = ({ scene, ...zones }: HudLayoutProps): ReactElement => {
  const viewportClass = useViewportClass();

  const ZonesLayout = ZONES_LAYOUTS[viewportClass];

  return (
    <div className={cn(HUD_ROOT_CLASS_NAMES[viewportClass], HUD_PASSTHROUGH_CLASS_NAME)}>
      <div className={SCENE_CLASS_NAME} data-testid="hud-zone-scene">{scene}</div>
      <ZonesLayout {...zones} />
    </div>
  );
};
