import type { CatalogShapeValue } from '@/shared/i18n';

export const warehouseSensorAlertMessages = {
  'sensorAlert.opened': 'Тревога в зоне {zoneCode}. Температура {temperature}\u00a0°C при пороге {threshold}\u00a0°C',
  'sensorAlert.resolved': 'Температура в норме. В зоне {zoneCode} датчик зафиксировал {temperature}\u00a0°C',
  'sensorAlert.resolvedWithoutReading': 'Температура в норме. Тревога в зоне {zoneCode} закрыта',
} as const satisfies CatalogShapeValue;
