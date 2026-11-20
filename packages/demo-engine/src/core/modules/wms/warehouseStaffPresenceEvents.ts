import { create } from '@bufbuild/protobuf';
import { staffChannel } from '@skladburg/contracts/runtime';
import { WarehouseStaffPresenceChangedSchema } from '@skladburg/contracts/wms/v1/warehouse_staff_presence_events';

import type { IStateTransaction } from '../../state/index';
import type { IEventOutbox } from '../moduleRuntime';

export const publishWarehouseStaffPresenceChanged = (transaction: IStateTransaction, outbox: IEventOutbox, warehouseId: string): void => {
  outbox.add(transaction, staffChannel(warehouseId), {
    case: 'warehouseStaffPresenceChanged',
    value: create(WarehouseStaffPresenceChangedSchema, { warehouseId }),
  });
};
