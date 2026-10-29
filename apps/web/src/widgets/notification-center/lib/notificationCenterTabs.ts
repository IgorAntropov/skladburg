import type { ReactNode } from 'react';

export type NotificationCenterTabValue = 'help' | 'notifications';

export interface NotificationHelpTabSlotValue {
  loadingFallback: ReactNode;
  renderLoadError: (onRetry: () => void) => ReactNode;
}

export interface NotificationTabRequestValue {
  request: number;
  tab: NotificationCenterTabValue;
}

export type RenderNotificationHelpTab = (slot: NotificationHelpTabSlotValue) => ReactNode;
