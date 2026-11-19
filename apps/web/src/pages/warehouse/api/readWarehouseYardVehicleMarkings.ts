import {
  WarehouseReceivingService,
  YardVehicleAccent,
} from '@skladburg/contracts/wms/v1/receiving';

import type { ApiClient } from '@/shared/api';

import { collectPages } from '@/shared/api';

import type {
  WarehouseYardVehicleAccentValue,
  WarehouseYardVehicleMarkingVisualValue,
} from '../model/warehouseYardVehicleMarkingVisual';

export interface WarehouseYardVehicleMarkingRowValue extends WarehouseYardVehicleMarkingVisualValue {
  taskId: string;
}

const BATCH_SIZE = 100;

const ACCENTS: Readonly<Record<YardVehicleAccent, undefined | WarehouseYardVehicleAccentValue>> = {
  [YardVehicleAccent.BLUE]: 'blue',
  [YardVehicleAccent.GREEN]: 'green',
  [YardVehicleAccent.OCHRE]: 'ochre',
  [YardVehicleAccent.SLATE]: 'slate',
  [YardVehicleAccent.TERRACOTTA]: 'terracotta',
  [YardVehicleAccent.UNSPECIFIED]: undefined,
};

export const readWarehouseYardVehicleMarkings = async (
  client: ApiClient,
  warehouseId: string,
  taskIds: readonly string[],
  signal: AbortSignal,
): Promise<WarehouseYardVehicleMarkingRowValue[]> => {
  const service = client.service(WarehouseReceivingService);
  const rows: WarehouseYardVehicleMarkingRowValue[] = [];

  for (let start = 0; start < taskIds.length; start += BATCH_SIZE) {
    const batch = taskIds.slice(start, start + BATCH_SIZE);
    const markings = await collectPages(async (page) => {
      signal.throwIfAborted();
      const response = await service.listYardVehicleMarkings({ page, taskIds: batch, warehouseId }, { signal });
      return { items: response.markings, nextPageToken: response.page?.nextPageToken ?? '' };
    });
    for (const { brand, registrationNumber, taskId } of markings) {
      const logoPath = brand?.logo?.lightUrl;
      rows.push({
        accent: ACCENTS[brand?.yardAccent ?? YardVehicleAccent.UNSPECIFIED],
        brandName: brand?.name === '' ? undefined : brand?.name,
        logoPath: logoPath === '' ? undefined : logoPath,
        registrationNumber: registrationNumber === '' ? undefined : registrationNumber,
        taskId,
      });
    }
  }

  return rows;
};
