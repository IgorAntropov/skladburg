import type { WarehouseSensorAlert } from '@skladburg/contracts/common/v1/warehouse_sensor_alert';

import { create } from '@bufbuild/protobuf';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  NotificationImportance,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import {
  NotificationsChange,
  NotificationsChangedSchema,
} from '@skladburg/contracts/notification/v1/notification_events';
import {
  getPermissionName,
  sensorsChannel,
  userChannel,
} from '@skladburg/contracts/runtime';
import { WarehouseSensorAlertsChangedSchema } from '@skladburg/contracts/wms/v1/warehouse_sensor_alert_events';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { resolveWarehouseRecipients } from './resolveWarehouseRecipients';

const SENSOR_VIEW_PERMISSION = getPermissionName(PermissionCode.SENSOR_VIEW);

export const publishWarehouseSensorAlert = (runtime: IModuleRuntime, transaction: IStateTransaction, alert: WarehouseSensorAlert): void => {
  const warehouse = transaction.get('warehouses', alert.warehouseId);
  if (warehouse === undefined) {
    return;
  }

  const recipients = resolveWarehouseRecipients(transaction, warehouse, SENSOR_VIEW_PERMISSION);
  const params = { case: 'warehouseSensorAlert', value: alert } as const;
  if (alert.resolvedAt === undefined) {
    runtime.notifier.post(transaction, {
      createdAt: alert.openedAt,
      importance: NotificationImportance.CRITICAL,
      kind: NotificationKind.WAREHOUSE_SENSOR_ALERT,
      links: [],
      organizationId: warehouse.tenantId,
      params,
      recipients,
    });
  }
  else {
    const visibleUsers = new Set(recipients);
    for (const { notification, userId } of transaction.listBy('notifications', 'sensorAlertId', alert.id)) {
      if (notification.organizationId !== warehouse.tenantId || notification.params.case !== 'warehouseSensorAlert'
        || notification.params.value.warehouseId !== warehouse.id) {
        continue;
      }
      transaction.put('notifications', { notification: { ...notification, params }, userId });
      if (visibleUsers.has(userId)) {
        runtime.outbox.add(transaction, userChannel(userId), {
          case: 'notificationsChanged',
          value: create(NotificationsChangedSchema, { change: NotificationsChange.UPDATED, notificationIds: [notification.id] }),
        });
      }
    }
  }

  runtime.outbox.add(transaction, sensorsChannel(warehouse.id), {
    case: 'warehouseSensorAlertsChanged',
    value: create(WarehouseSensorAlertsChangedSchema, { warehouseId: warehouse.id }),
  });
};
