import type { GetWarehouseEquipmentResponse } from '@skladburg/contracts/wms/v1/warehouse_equipment';

import type { I18nSnapshotValue } from '@/shared/i18n';

import type { WarehouseSceneEquipmentValue } from './warehouseSceneInteraction';

import {
  warehouseEquipmentLabels,
  warehouseEquipmentStatusKey,
} from '../i18n/warehouseEquipmentLabels';

export const projectWarehouseSceneEquipment = (
  facts: GetWarehouseEquipmentResponse | undefined,
  { createSectionTranslator, formatNumber }: Pick<I18nSnapshotValue, 'createSectionTranslator' | 'formatNumber'>,
): undefined | WarehouseSceneEquipmentValue => {
  if (facts === undefined || (facts.equipment.length === 0 && facts.stations.length === 0)) {
    return undefined;
  }
  const t = createSectionTranslator(warehouseEquipmentLabels);
  return {
    stations: facts.stations.map(({ code, equipmentId, id }) => ({
      equipmentId,
      id,
      label: t('warehouseEquipment.stationLabel', { code, status: t(equipmentId === undefined
        ? 'warehouseEquipment.stationFree'
        : 'warehouseEquipment.stationBusy') }),
    })),
    units: facts.equipment.map(({ batteryPercent, chargingStationId, code, id, status, taskId }) => {
      const battery = formatNumber(batteryPercent / 100, { style: 'percent' });
      const statusLabel = t(warehouseEquipmentStatusKey(status));
      return {
        badge: t('warehouseEquipment.batteryLabel', { battery, code }),
        chargingStationId,
        id,
        label: t('warehouseEquipment.unitLabel', { battery, code, status: statusLabel }),
        status,
        statusLabel,
        taskId,
      };
    }),
  };
};
