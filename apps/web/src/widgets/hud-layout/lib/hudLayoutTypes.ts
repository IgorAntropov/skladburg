import type { ReactNode } from 'react';

import type { TabsItemValue } from '@/shared/ui';

export interface HudLayoutProps {
  inspector: ReactNode;
  inspectorKey?: string | undefined;
  isInspectorOpen: boolean;
  kpi?: ReactNode | undefined;
  listsHeader?: ReactNode | undefined;
  listTabs?: readonly TabsItemValue[] | undefined;
  onInspectorClose: () => void;
  panel?: ReactNode | undefined;
  scene: ReactNode;
  tracker?: ReactNode | undefined;
}

export type HudZonesProps = Omit<HudLayoutProps, 'scene'>;
