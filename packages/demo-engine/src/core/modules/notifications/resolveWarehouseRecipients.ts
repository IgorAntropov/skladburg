import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import type { IStateReader } from '../../state/index';

import {
  isWarehouseInScope,
  resolveEffectivePermissions,
} from '../../access/index';
import { WAREHOUSE_CHANNEL_PERMISSION } from '../../events/index';
import { compareIds } from '../../state/index';

export const resolveWarehouseRecipients = (reader: IStateReader, warehouse: Warehouse): string[] => {
  const recipients = new Set<string>();

  for (const membership of reader.listBy('memberships', 'organizationId', warehouse.tenantId)) {
    const effective = resolveEffectivePermissions(reader, membership).find(
      candidate => candidate.permission === WAREHOUSE_CHANNEL_PERMISSION,
    );

    if (effective !== undefined && isWarehouseInScope(effective, warehouse.id)) {
      recipients.add(membership.userId);
    }
  }

  return [...recipients].sort(compareIds);
};
