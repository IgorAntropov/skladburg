import type { WarehouseSensorAlert } from '@skladburg/contracts/common/v1/warehouse_sensor_alert';

import type { I18nSnapshotValue } from '@/shared/i18n';

import { warehouseSensorAlertMessages } from '../i18n/warehouseSensorAlertRu';

export const formatWarehouseSensorAlert = (
  createSectionTranslator: I18nSnapshotValue['createSectionTranslator'],
  { openedDeciCelsius, resolvedAt, resolvedDeciCelsius, thresholdDeciCelsius, zoneCode }: WarehouseSensorAlert,
): string => {
  const t = createSectionTranslator(warehouseSensorAlertMessages);
  if (resolvedAt === undefined) {
    return t('sensorAlert.opened', { temperature: openedDeciCelsius / 10, threshold: thresholdDeciCelsius / 10, zoneCode });
  }

  return resolvedDeciCelsius === undefined
    ? t('sensorAlert.resolvedWithoutReading', { zoneCode })
    : t('sensorAlert.resolved', { temperature: resolvedDeciCelsius / 10, zoneCode });
};
