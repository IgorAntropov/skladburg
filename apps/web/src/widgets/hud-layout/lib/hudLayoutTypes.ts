import type {
  ReactNode,
  RefCallback,
} from 'react';

import type { TabsItemValue } from '@/shared/ui';

export interface HudLayoutProps {
  canCollapsePanels?: boolean | undefined;
  defaultListTabId?: string | undefined;
  inspector: ReactNode;
  inspectorKey?: string | undefined;
  isInspectorOpen: boolean;
  kpi?: ReactNode | undefined;
  listsHeader?: ReactNode | undefined;
  listTabs?: readonly TabsItemValue[] | undefined;
  listTabsResetKey?: number | string | undefined;
  onInspectorClose: () => void;
  panel?: ReactNode | undefined;
  scene: ReactNode;
  sceneControls?: ReactNode | undefined;
  tracker?: ReactNode | undefined;
}

export interface HudZonesProps extends Omit<HudLayoutProps, 'scene'> {
  freeAreaRef: RefCallback<HTMLDivElement>;
}
