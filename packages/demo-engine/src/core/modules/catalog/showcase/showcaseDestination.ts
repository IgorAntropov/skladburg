import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { CalendarDateValue } from '../../../calendar/index';
import type { IModuleRuntime } from '../../moduleRuntime';
import type { RouteValue } from '../../network/index';

import { toCalendarDate } from '../../../calendar/index';
import { findInterWarehouseRoutes } from '../../network/index';

export interface ShowcaseDestinationValue {
  routes: ReadonlyMap<string, RouteValue> | undefined;
  timeZone: string;
  today: CalendarDateValue;
}

const DEFAULT_TIME_ZONE = 'UTC';

export const resolveShowcaseDestination = (
  runtime: IModuleRuntime,
  organizationId: string,
  toWarehouseId: string,
): ShowcaseDestinationValue => {
  const worldTimeMs = runtime.getWorldTimeMs();

  if (toWarehouseId === '') {
    return { routes: undefined, timeZone: DEFAULT_TIME_ZONE, today: toCalendarDate(worldTimeMs, DEFAULT_TIME_ZONE) };
  }

  const { read } = runtime;
  const warehouse = read.get('warehouses', toWarehouseId);

  if (warehouse?.tenantId !== organizationId) {
    throw runtime.errors.notFound(EntityKind.WAREHOUSE);
  }

  return {
    routes: findInterWarehouseRoutes(read, warehouse),
    timeZone: warehouse.timeZone,
    today: toCalendarDate(worldTimeMs, warehouse.timeZone),
  };
};
