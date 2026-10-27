type NotificationCenterEntryModuleValue = typeof import('./panel/notificationCenterEntry');

export const loadNotificationCenterPanel = (): Promise<NotificationCenterEntryModuleValue> => import('./panel/notificationCenterEntry');
