import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  CarrierLaneSchema,
  DriverSchema,
  FleetService,
  ListCarrierLanesResponseSchema,
  ListDriversResponseSchema,
  ListVehiclesResponseSchema,
  SaveCarrierLaneResponseSchema,
  SaveDriverResponseSchema,
  SaveVehicleResponseSchema,
  VehicleSchema,
} from '@skladburg/contracts/fleet/v1/fleet';

import type { IModuleRuntime } from '../moduleRuntime';

import { readOwnedForSave } from '../catalog/versionedRecords';
import { paginate } from '../pagination';
import {
  collectCarrierLaneViolations,
  collectVehicleViolations,
  normalizeRegistrationNumber,
} from './fleetRules';

export const createFleetService = (runtime: IModuleRuntime): ServiceImpl<typeof FleetService> => {
  const {
    command,
    errors,
    guard,
    idempotency,
    read,
  } = runtime;

  return {
    listCarrierLanes: (request, context) => {
      const caller = guard.guardPermissionCall(read, FleetService.method.listCarrierLanes, request, context.requestHeader);
      const lanes = read.listBy('carrierLanes', 'tenantId', caller.organizationId);
      const { items, page } = paginate(lanes, lane => lane.id, request.page, errors);

      return create(ListCarrierLanesResponseSchema, { carrierLanes: items, page });
    },
    listDrivers: (request, context) => {
      const caller = guard.guardPermissionCall(read, FleetService.method.listDrivers, request, context.requestHeader);
      const drivers = read.listBy('drivers', 'tenantId', caller.organizationId);
      const { items, page } = paginate(drivers, driver => driver.id, request.page, errors);

      return create(ListDriversResponseSchema, { drivers: items, page });
    },
    listVehicles: (request, context) => {
      const caller = guard.guardPermissionCall(read, FleetService.method.listVehicles, request, context.requestHeader);
      const vehicles = read.listBy('vehicles', 'tenantId', caller.organizationId);
      const { items, page } = paginate(vehicles, vehicle => vehicle.id, request.page, errors);

      return create(ListVehiclesResponseSchema, { page, vehicles: items });
    },
    saveCarrierLane: (request, context) => command((transaction) => {
      const method = FleetService.method.saveCarrierLane;
      const { organizationId } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const current = readOwnedForSave(
            errors,
            EntityKind.CARRIER_LANE,
            transaction.get('carrierLanes', request.carrierLaneId),
            organizationId,
            request.expectedVersion,
          );
          const violations = collectCarrierLaneViolations(transaction, organizationId, request);
          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const carrierLane = create(CarrierLaneSchema, {
            departureWeekdays: request.departureWeekdays,
            fromCityId: request.fromCityId,
            id: request.carrierLaneId,
            isActive: request.isActive,
            tariff: request.tariff,
            tenantId: organizationId,
            toCityId: request.toCityId,
            version: (current?.version ?? 0n) + 1n,
          });
          transaction.put('carrierLanes', carrierLane);

          return create(SaveCarrierLaneResponseSchema, { carrierLane });
        },
        idempotencyKey: request.idempotencyKey,
        method,
        request,
        scope: organizationId,
      });
    }),
    saveDriver: (request, context) => command((transaction) => {
      const method = FleetService.method.saveDriver;
      const { organizationId } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const current = readOwnedForSave(
            errors,
            EntityKind.DRIVER,
            transaction.get('drivers', request.driverId),
            organizationId,
            request.expectedVersion,
          );
          const displayName = request.displayName.trim();
          if (displayName === '') {
            throw errors.validationFailed([{ fieldPath: 'display_name', ruleId: 'string.min_len' }]);
          }

          const driver = create(DriverSchema, {
            displayName,
            id: request.driverId,
            isActive: request.isActive,
            tenantId: organizationId,
            version: (current?.version ?? 0n) + 1n,
          });
          transaction.put('drivers', driver);

          return create(SaveDriverResponseSchema, { driver });
        },
        idempotencyKey: request.idempotencyKey,
        method,
        request,
        scope: organizationId,
      });
    }),
    saveVehicle: (request, context) => command((transaction) => {
      const method = FleetService.method.saveVehicle;
      const { organizationId } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const current = readOwnedForSave(
            errors,
            EntityKind.VEHICLE,
            transaction.get('vehicles', request.vehicleId),
            organizationId,
            request.expectedVersion,
          );
          if (request.details === undefined) {
            throw errors.internal();
          }

          const details = { ...request.details, registrationNumber: normalizeRegistrationNumber(request.details.registrationNumber) };
          const violations = collectVehicleViolations(transaction, organizationId, request.vehicleId, details);
          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const vehicle = create(VehicleSchema, {
            details,
            id: request.vehicleId,
            tenantId: organizationId,
            version: (current?.version ?? 0n) + 1n,
          });
          transaction.put('vehicles', vehicle);

          return create(SaveVehicleResponseSchema, { vehicle });
        },
        idempotencyKey: request.idempotencyKey,
        method,
        request,
        scope: organizationId,
      });
    }),
  };
};
