import type { ReactElement } from 'react';

import {
  useRef,
  useState,
} from 'react';

import type { ViewportClassValue } from '@/shared/lib/viewport';

import { cn } from '@/shared/lib/cn';
import {
  SceneInsetsContext,
  useViewportClass,
} from '@/shared/lib/viewport';

import type {
  HudLayoutProps,
  HudZonesProps,
} from '../lib/hudLayoutTypes';

import { useSceneInsetsMeasure } from '../lib/useSceneInsetsMeasure';
import { DesktopHudLayout } from './DesktopHudLayout';
import {
  HUD_INTERACTIVE_CLASS_NAME,
  HUD_PASSTHROUGH_CLASS_NAME,
  HUD_ROOT_CLASS_NAMES,
} from './hudStyles';
import { PhoneHudLayout } from './PhoneHudLayout';
import { TabletHudLayout } from './TabletHudLayout';

const SCENE_CLASS_NAME = cn('fixed inset-0 -z-10', HUD_INTERACTIVE_CLASS_NAME);

const ZONES_LAYOUTS: Readonly<Record<ViewportClassValue, (props: HudZonesProps) => ReactElement>> = {
  desktop: DesktopHudLayout,
  phone: PhoneHudLayout,
  tablet: TabletHudLayout,
};

export const HudLayout = ({ scene, ...zones }: HudLayoutProps): ReactElement => {
  const viewportClass = useViewportClass();
  const sceneRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [freeAreaElement, setFreeAreaElement] = useState<HTMLDivElement | null>(null);
  const sceneInsets = useSceneInsetsMeasure(sceneRef, rootRef, freeAreaElement);

  const ZonesLayout = ZONES_LAYOUTS[viewportClass];

  return (
    <div className={cn(HUD_ROOT_CLASS_NAMES[viewportClass], HUD_PASSTHROUGH_CLASS_NAME)} ref={rootRef}>
      <SceneInsetsContext value={sceneInsets}>
        <div className={SCENE_CLASS_NAME} data-testid="hud-zone-scene" ref={sceneRef}>{scene}</div>
      </SceneInsetsContext>
      <ZonesLayout {...zones} freeAreaRef={setFreeAreaElement} />
    </div>
  );
};
