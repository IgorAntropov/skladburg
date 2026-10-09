import type { ReactElement } from 'react';

import type { ViewportClassValue } from '@/shared/lib/viewport';

import { useViewportClass } from '@/shared/lib/viewport';

import type {
  HudLayoutProps,
  HudZonesProps,
} from '../lib/hudLayoutTypes';

import { DesktopHudLayout } from './DesktopHudLayout';
import {
  HUD_ROOT_CLASS_NAMES,
  HUD_SCENE_CLASS_NAME,
} from './hudStyles';
import { PhoneHudLayout } from './PhoneHudLayout';
import { TabletHudLayout } from './TabletHudLayout';

const ZONES_LAYOUTS: Readonly<Record<ViewportClassValue, (props: HudZonesProps) => ReactElement>> = {
  desktop: DesktopHudLayout,
  phone: PhoneHudLayout,
  tablet: TabletHudLayout,
};

export const HudLayout = ({ scene, ...zones }: HudLayoutProps): ReactElement => {
  const viewportClass = useViewportClass();

  const ZonesLayout = ZONES_LAYOUTS[viewportClass];

  return (
    <div className={HUD_ROOT_CLASS_NAMES[viewportClass]}>
      <div className={HUD_SCENE_CLASS_NAME} data-testid="hud-zone-scene">{scene}</div>
      <ZonesLayout {...zones} />
    </div>
  );
};
