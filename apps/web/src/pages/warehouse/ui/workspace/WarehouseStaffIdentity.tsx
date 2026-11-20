import type { WarehouseStaffSummary } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import type { ReactElement } from 'react';

import { WarehouseStaffWorkRole } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';

import { Avatar } from '@/shared/ui';

import type { WarehouseStaffTranslate } from '../../i18n/warehouseStaffSection';

const WORK_ROLE_TEXT = {
  [WarehouseStaffWorkRole.CONTROLLER]: 'warehouseStaff.role.controller',
  [WarehouseStaffWorkRole.FORKLIFT_OPERATOR]: 'warehouseStaff.role.forklift',
  [WarehouseStaffWorkRole.PICKER]: 'warehouseStaff.role.picker',
  [WarehouseStaffWorkRole.SHIFT_LEAD]: 'warehouseStaff.role.lead',
  [WarehouseStaffWorkRole.STOREKEEPER]: 'warehouseStaff.role.storekeeper',
  [WarehouseStaffWorkRole.UNSPECIFIED]: 'warehouseStaff.noData',
} as const;

interface WarehouseStaffIdentityProps {
  showWarehouse: boolean;
  staff: WarehouseStaffSummary;
  t: WarehouseStaffTranslate;
}

export const WarehouseStaffIdentity = ({ showWarehouse, staff, t }: WarehouseStaffIdentityProps): ReactElement => (
  <>
    <Avatar name={staff.displayName} seed={staff.avatarKey} size="sm" />
    <span className="min-w-0 grow wrap-anywhere">
      <span className="block font-semibold" translate="no">{staff.displayName}</span>
      <span className="block text-sm font-normal text-on-panel-muted">
        {t(WORK_ROLE_TEXT[staff.workRole])}
        {showWarehouse && (
          <span translate="no">
            {' · '}
            {staff.warehouseName}
          </span>
        )}
      </span>
    </span>
  </>
);
