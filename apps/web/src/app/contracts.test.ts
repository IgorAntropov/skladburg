import { create } from '@bufbuild/protobuf';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  OrganizationService,
  WarehouseCapability,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

describe('API contract', () => {
  it('creates a warehouse message with the given fields', () => {
    const warehouse = create(WarehouseSchema, {
      capabilities: [WarehouseCapability.COLD, WarehouseCapability.RAMP],
      id: '2f1b7c1e-8c1d-4d53-9d3a-0a6f6f4b1a10',
      isWmsEnabled: true,
      name: 'Склад «Север»',
    });

    expect(warehouse.id).toBe('2f1b7c1e-8c1d-4d53-9d3a-0a6f6f4b1a10');
    expect(warehouse.name).toBe('Склад «Север»');
    expect(warehouse.isWmsEnabled).toBe(true);
    expect(warehouse.capabilities).toEqual([WarehouseCapability.COLD, WarehouseCapability.RAMP]);
    expect(warehouse.address).toBe('');
  });

  it('describes the organization service methods', () => {
    expect(OrganizationService.method).toHaveProperty('listWarehouses');
    expect(OrganizationService.method).toHaveProperty('createWarehouse');
  });

  it('exposes error codes as numbers', () => {
    expect(typeof ErrorCode.PERMISSION_DENIED).toBe('number');
    expect(ErrorCode.PERMISSION_DENIED).not.toBe(ErrorCode.UNSPECIFIED);
  });
});
