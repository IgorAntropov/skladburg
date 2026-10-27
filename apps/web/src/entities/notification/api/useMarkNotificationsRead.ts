import { NotificationService } from '@skladburg/contracts/notification/v1/notification';

import type { CommandValue } from '@/shared/api';

import { applyNotificationsRead } from '../lib/applyNotificationsRead';
import { useReadCommand } from './useReadCommand';

export const useMarkNotificationsRead = (notificationIds: readonly string[]): CommandValue => useReadCommand({
  applyRead: (response, readAt) => applyNotificationsRead(response, notificationIds, readAt),
  method: NotificationService.method.markNotificationsRead,
  send: (client, idempotencyKey) => client.service(NotificationService).markNotificationsRead({
    idempotencyKey,
    notificationIds: [...notificationIds],
  }),
});
