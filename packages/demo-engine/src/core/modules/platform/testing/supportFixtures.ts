import type { MessageInitShape } from '@bufbuild/protobuf';
import type {
  SupportErrorRef,
  SupportTicketContext,
} from '@skladburg/contracts/support/v1/support_ticket';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  DeviceBrowserFamily,
  DeviceFormFactor,
  DeviceOsFamily,
  SupportDeviceSchema,
  SupportErrorRefSchema,
  SupportTicketContextSchema,
} from '@skladburg/contracts/support/v1/support_ticket';

export const FIRST_KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

export const createTraceId = (index: number): string => `7a1d0c2e-9b3f-4e68-a5d4-${String(index).padStart(12, '0')}`;

export const createSupportErrorRef = (
  traceId: string,
  occurredAtMs: number,
  code: ErrorCode = ErrorCode.PERMISSION_DENIED,
): SupportErrorRef => create(SupportErrorRefSchema, {
  code,
  method: 'organization.v1.OrganizationService/CreateWarehouse',
  occurredAt: timestampFromMs(occurredAtMs),
  traceId,
});

export const createSupportContext = (
  overrides: MessageInitShape<typeof SupportTicketContextSchema> = {},
): SupportTicketContext => create(SupportTicketContextSchema, {
  appVersion: '3f9c2ab',
  device: create(SupportDeviceSchema, {
    browserFamily: DeviceBrowserFamily.SAFARI,
    formFactor: DeviceFormFactor.DESKTOP,
    isInstalled: false,
    osFamily: DeviceOsFamily.MACOS,
  }),
  errors: [],
  screenPath: '/network',
  ...overrides,
});
