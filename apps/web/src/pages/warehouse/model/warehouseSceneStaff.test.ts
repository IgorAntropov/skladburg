import { create } from '@bufbuild/protobuf';
import { WarehouseStaffAreaPresenceSchema } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import {
  WarehouseStaffSummarySchema,
  WarehouseStaffWorkRole,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import {
  expect,
  it,
} from 'vitest';

import { createTestLocalizer } from '@/shared/i18n/index.testing';

import { projectWarehouseSceneStaff } from './warehouseSceneStaff';

it('keeps area totals independent from visible people and preserves missing plans', async () => {
  const i18n = (await createTestLocalizer()).getSnapshot();
  const areas = [
    { areaId: 'first', observedStaffCount: 0, plannedStaffCount: 2 },
    { areaId: 'second', observedStaffCount: 2, plannedStaffCount: 1 },
    { areaId: 'third', observedStaffCount: 0, plannedStaffCount: 0 },
    { areaId: 'fourth', observedStaffCount: 1 },
  ].map(area => create(WarehouseStaffAreaPresenceSchema, area));

  const projected = projectWarehouseSceneStaff(areas, undefined, 'warehouse', i18n);
  expect(projected.map(area => area.counter?.comparison)).toEqual(['shortage', 'surplus', 'balanced', 'unknown']);
  expect(projected.map(area => area.counter?.text)).toEqual(['first · 0/2', 'second · 2/1', 'third · 0/0', 'fourth · 1']);
  expect(projected.every(area => area.staff.length === 0)).toBe(true);
});

it('places only the permitted people with observed areas in the same warehouse even without aggregate access', async () => {
  const i18n = (await createTestLocalizer()).getSnapshot();
  const visible = create(WarehouseStaffSummarySchema, {
    avatarKey: 'picker', displayName: 'Лев Речкин', observedAreaId: 'observed', staffId: 'picker',
    warehouseId: 'warehouse', workRole: WarehouseStaffWorkRole.PICKER,
  });
  const members = [
    visible,
    create(WarehouseStaffSummarySchema, { ...visible, observedAreaId: undefined, staffId: 'scheduled' }),
    create(WarehouseStaffSummarySchema, { ...visible, staffId: 'neighbor', warehouseId: 'other' }),
  ];

  expect(projectWarehouseSceneStaff(undefined, members, 'warehouse', i18n)).toEqual([{
    areaId: 'observed',
    counter: undefined,
    staff: [{ avatarKey: 'picker', displayName: 'Лев Речкин', staffId: 'picker', workRole: WarehouseStaffWorkRole.PICKER }],
  }]);
});
