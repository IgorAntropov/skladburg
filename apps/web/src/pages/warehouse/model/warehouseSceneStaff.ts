import type { WarehouseStaffAreaPresence } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import type { WarehouseStaffSummary } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';

import type { I18nSnapshotValue } from '@/shared/i18n';

import type {
  WarehouseSceneStaffAreaValue,
  WarehouseSceneStaffCounterValue,
  WarehouseSceneStaffPersonValue,
} from './warehouseSceneInteraction';

import { warehouseSceneStaffMessages } from '../i18n/warehouseSceneStaffRu';

export const projectWarehouseSceneStaff = (
  areas: readonly WarehouseStaffAreaPresence[] | undefined,
  members: readonly WarehouseStaffSummary[] | undefined,
  warehouseId: string,
  { createSectionTranslator, formatNumber }: Pick<I18nSnapshotValue, 'createSectionTranslator' | 'formatNumber'>,
): WarehouseSceneStaffAreaValue[] => {
  const t = createSectionTranslator(warehouseSceneStaffMessages);
  const counters = new Map<string, WarehouseSceneStaffCounterValue>();
  for (const { areaCode, areaId, observedStaffCount, plannedStaffCount } of areas ?? []) {
    const area = areaCode || areaId;
    const fact = formatNumber(observedStaffCount);
    if (plannedStaffCount === undefined) {
      counters.set(areaId, {
        comparison: 'unknown',
        label: t('warehouseSceneStaff.observed', { area, fact }),
        text: t('warehouseSceneStaff.counter', { area, fact }),
      });
    }
    else {
      const comparison = observedStaffCount === plannedStaffCount
        ? 'balanced'
        : observedStaffCount < plannedStaffCount ? 'shortage' : 'surplus';
      const plan = formatNumber(plannedStaffCount);
      counters.set(areaId, {
        comparison,
        label: t('warehouseSceneStaff.planned', { area, comparison: t(`warehouseSceneStaff.${comparison}`), fact, plan }),
        text: t('warehouseSceneStaff.counterPlan', { area, fact, plan }),
      });
    }
  }

  const people = new Map<string, WarehouseSceneStaffPersonValue[]>();
  for (const { avatarKey, displayName, observedAreaId, staffId, warehouseId: memberWarehouseId, workRole } of members ?? []) {
    if (observedAreaId === undefined || memberWarehouseId !== warehouseId) {
      continue;
    }
    const group = people.get(observedAreaId) ?? [];
    group.push({ avatarKey, displayName, staffId, workRole });
    people.set(observedAreaId, group);
  }
  return [...new Set([...counters.keys(), ...people.keys()])].map(areaId => ({
    areaId, counter: counters.get(areaId), staff: people.get(areaId) ?? [],
  }));
};
