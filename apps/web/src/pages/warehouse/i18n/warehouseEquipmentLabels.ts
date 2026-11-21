import { WarehouseEquipmentStatus } from '@skladburg/contracts/wms/v1/warehouse_equipment';

export const warehouseEquipmentLabels = {
  'warehouseEquipment.batteryLabel': '{code} · {battery}',
  'warehouseEquipment.stationBusy': 'Занята',
  'warehouseEquipment.stationFree': 'Свободна',
  'warehouseEquipment.stationLabel': '{code} · {status}',
  'warehouseEquipment.statusAvailable': 'Свободен',
  'warehouseEquipment.statusCarrying': 'Везёт груз',
  'warehouseEquipment.statusCharging': 'Заряжается',
  'warehouseEquipment.statusHandling': 'Обрабатывает груз',
  'warehouseEquipment.statusRepair': 'В ремонте',
  'warehouseEquipment.statusToTask': 'Едет к заданию',
  'warehouseEquipment.statusUnknown': 'Статус неизвестен',
  'warehouseEquipment.statusWaiting': 'Ждёт зарядки',
  'warehouseEquipment.unitLabel': '{code} · {status} · {battery}',
};

const statusKeys = {
  [WarehouseEquipmentStatus.AVAILABLE]: 'warehouseEquipment.statusAvailable',
  [WarehouseEquipmentStatus.CARRYING]: 'warehouseEquipment.statusCarrying',
  [WarehouseEquipmentStatus.CHARGING]: 'warehouseEquipment.statusCharging',
  [WarehouseEquipmentStatus.HANDLING]: 'warehouseEquipment.statusHandling',
  [WarehouseEquipmentStatus.IN_REPAIR]: 'warehouseEquipment.statusRepair',
  [WarehouseEquipmentStatus.TO_TASK]: 'warehouseEquipment.statusToTask',
  [WarehouseEquipmentStatus.UNSPECIFIED]: 'warehouseEquipment.statusUnknown',
  [WarehouseEquipmentStatus.WAITING_FOR_CHARGE]: 'warehouseEquipment.statusWaiting',
} as const satisfies Record<WarehouseEquipmentStatus, keyof typeof warehouseEquipmentLabels>;

export const warehouseEquipmentStatusKey = (status: WarehouseEquipmentStatus): typeof statusKeys[WarehouseEquipmentStatus] =>
  Object.hasOwn(statusKeys, status) ? statusKeys[status] : 'warehouseEquipment.statusUnknown';
