import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

export interface WarehouseCellAddressValue {
  code: string;
  id: string;
  rackCode: string;
  rowCode: string;
  tierCode: string;
  zoneCode: string;
}

export const getWarehouseCells = (topology: null | undefined | WarehouseTopology): WarehouseCellAddressValue[] =>
  topology?.storageZones.flatMap(zone => zone.rows.flatMap(row => row.racks.flatMap(rack => rack.tiers.flatMap(tier =>
    tier.cells.map(cell => ({
      code: cell.code,
      id: cell.id,
      rackCode: rack.code,
      rowCode: row.code,
      tierCode: tier.code,
      zoneCode: zone.code,
    })))))) ?? [];
