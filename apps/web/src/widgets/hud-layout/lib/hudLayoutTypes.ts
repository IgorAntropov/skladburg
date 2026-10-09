import type { ReactNode } from 'react';

export interface HudLayoutProps {
  inspector: ReactNode;
  inspectorKey?: string | undefined;
  isInspectorOpen: boolean;
  kpi?: ReactNode | undefined;
  lists?: ReactNode | undefined;
  onInspectorClose: () => void;
  panel?: ReactNode | undefined;
  scene: ReactNode;
  tracker?: ReactNode | undefined;
}

export type HudZonesProps = Omit<HudLayoutProps, 'scene'>;
