import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';

import type { WarehouseTopologyRecordValue } from '../../state/records';

export const encodeWarehouseTopology = (topology: WarehouseTopology): WarehouseTopologyRecordValue => ({
  id: topology.warehouseId,
  topologyBytes: toBinary(WarehouseTopologySchema, topology),
});

export const readWarehouseTopology = (record: WarehouseTopologyRecordValue): WarehouseTopology =>
  fromBinary(WarehouseTopologySchema, record.topologyBytes);
