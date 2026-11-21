import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetWarehouseStaffProfileResponseSchema,
  ListWarehouseStaffResponseSchema,
  WarehouseStaffProfileService,
  WarehouseStaffQualificationStatus,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import { isWarehouseInScope } from '../../access/permissionScope';
import { compareCalendarDates } from '../../calendar/calendarDate';
import { toCalendarDate } from '../../calendar/zonedTime';
import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { paginate } from '../pagination';
import {
  readStaffActivity,
  readStaffPerformance,
  readStaffShiftState,
} from './warehouseStaffActivity';
import { readVisibleStaff } from './warehouseStaffVisibility';

const EXPIRING_WITHIN_DAYS = 30;

export const createWarehouseStaffProfileService = (runtime: IModuleRuntime): ServiceImpl<typeof WarehouseStaffProfileService> => {
  const { errors, guard, read } = runtime;
  const { method } = WarehouseStaffProfileService;
  return {
    getWarehouseStaffProfile: (request, context) => {
      const caller = guard.guardPermissionCall(read, method.getWarehouseStaffProfile, request, context.requestHeader);
      const row = readVisibleStaff(runtime, caller, request.warehouseId).find(staff => staff.member.userId === request.staffId);
      if (row === undefined) {
        throw errors.notFound(EntityKind.WAREHOUSE_STAFF);
      }
      const { canReadPerformance, canReadQualifications, canReadWork, member, summary, timeZone } = row;
      const now = runtime.getWorldTimeMs();
      const today = toCalendarDate(now, timeZone);
      const assignment = runtime.wmsStaffSchedules?.get(member.warehouseId)?.find(slot => slot.areaId === member.workplace?.areaId);
      const activity = canReadWork ? readStaffActivity(runtime, member, canReadPerformance) : undefined;
      const qualifications = canReadQualifications
        ? { entries: member.credentials.map(({ expiresOn, kind }) => {
            const days = compareCalendarDates(expiresOn, today);
            let status = WarehouseStaffQualificationStatus.VALID;
            if (days < 0) {
              status = WarehouseStaffQualificationStatus.EXPIRED;
            }
            else if (days <= EXPIRING_WITHIN_DAYS) {
              status = WarehouseStaffQualificationStatus.EXPIRING;
            }
            return { expiresOn, kind, status };
          }) }
        : undefined;
      return create(GetWarehouseStaffProfileResponseSchema, {
        profile: {
          performance: canReadPerformance && activity !== undefined
            ? readStaffPerformance(activity.history, assignment, now, timeZone)
            : undefined,
          qualifications,
          summary,
          timeZone,
          work: activity === undefined
            ? undefined
            : {
                activeTasks: activity.activeTasks,
                shiftState: canReadPerformance ? readStaffShiftState(assignment, now, timeZone) : undefined,
              },
        },
      });
    },
    listWarehouseStaff: (request, context) => {
      const caller = guard.guardScopeFilteredCall(read, method.listWarehouseStaff, request, context.requestHeader);
      if (request.warehouseId !== undefined && !isWarehouseInScope(caller.scope, request.warehouseId)) {
        throw errors.permissionDenied('staff_profile_view', request.warehouseId);
      }
      if (request.warehouseId !== undefined && read.get('warehouses', request.warehouseId)?.tenantId !== caller.organizationId) {
        throw errors.notFound(EntityKind.WAREHOUSE);
      }
      const visible = readVisibleStaff(runtime, caller, request.warehouseId);
      const { items, page } = paginate(visible, ({ member }) => member.warehouseId + '/' + member.userId, request.page, errors);
      return create(ListWarehouseStaffResponseSchema, { page, staff: items.map(item => item.summary) });
    },
  };
};

export const createWarehouseStaffProfileHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(WarehouseStaffProfileService, createWarehouseStaffProfileService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
