import type { ReactElement } from 'react';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { WarehouseYardVehicleMarkingVisualValue } from '../../model/warehouseYardVehicleMarkingVisual';

interface WarehouseVehicleMarkingProps {
  marking: undefined | WarehouseYardVehicleMarkingVisualValue;
  t: WarehouseWorkTranslate;
}

export const WarehouseVehicleMarking = ({ marking, t }: WarehouseVehicleMarkingProps): null | ReactElement => {
  const brandName = marking?.brandName;
  const registrationNumber = marking?.registrationNumber;
  if (brandName === undefined && registrationNumber === undefined) {
    return null;
  }

  return (
    <>
      {brandName !== undefined && (
        <p className="text-sm text-on-panel-muted wrap-anywhere" data-testid="warehouse-yard-vehicle-owner" translate="no">{brandName}</p>
      )}
      {registrationNumber !== undefined && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-on-panel-muted">{t('warehouseWork.vehicleRegistration')}</span>
          <span className="font-semibold tabular-nums" data-testid="warehouse-yard-registration" translate="no">{registrationNumber}</span>
        </p>
      )}
    </>
  );
};
