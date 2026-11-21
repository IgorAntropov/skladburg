import { WarehouseSensorChannelKind } from '@skladburg/contracts/wms/v1/warehouse_sensors';

import { WAREHOUSE_SENSOR_SITE } from './warehouseSensorConfig';

export const SEED_WAREHOUSE_SENSORS = [{
  ...WAREHOUSE_SENSOR_SITE,
  channels: [
    { id: '8e000003-0000-4000-8000-000000000002', kind: WarehouseSensorChannelKind.TEMPERATURE },
    { id: '8e000003-0000-4000-8000-000000000003', kind: WarehouseSensorChannelKind.HUMIDITY },
    { id: '8e000003-0000-4000-8000-000000000004', kind: WarehouseSensorChannelKind.DOOR },
    { id: '8e000003-0000-4000-8000-000000000005', kind: WarehouseSensorChannelKind.CO2 },
  ],
  code: 'КЛ-01',
  id: '8e000003-0000-4000-8000-000000000001',
  thresholdDeciCelsius: 80,
}] as const;
