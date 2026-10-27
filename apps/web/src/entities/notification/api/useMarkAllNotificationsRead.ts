import { NotificationService } from '@skladburg/contracts/notification/v1/notification';

import type { CommandValue } from '@/shared/api';

import { applyAllNotificationsRead } from '../lib/applyNotificationsRead';
import { useReadCommand } from './useReadCommand';

interface UseMarkAllNotificationsReadOptionsValue {
  onSuccess: () => void;
}

export const useMarkAllNotificationsRead = ({ onSuccess }: UseMarkAllNotificationsReadOptionsValue): CommandValue => useReadCommand({
  applyRead: applyAllNotificationsRead,
  method: NotificationService.method.markAllNotificationsRead,
  onSuccess,
  send: (client, idempotencyKey) => client.service(NotificationService).markAllNotificationsRead({ idempotencyKey }),
});
