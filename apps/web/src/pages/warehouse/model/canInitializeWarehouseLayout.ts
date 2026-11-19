import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

export const canInitializeWarehouseLayout = (topology: null | undefined | WarehouseTopology): boolean =>
  topology === null || (topology !== undefined && topology.bounds === undefined
    && topology.receivingArea === undefined && topology.storageZones.length === 0);
