import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { getPermissionName } from '@skladburg/contracts/runtime';

export const MINUTE_MS = 60_000;
export const SUPPORT_ACCESS_EXPIRY_INTERVAL_MS = 15_000;
export const SUPPORT_ACCESS_REQUEST_TTL_MS = 60 * MINUTE_MS;

export const SUPPORT_ACCESS_APPROVE_PERMISSION = getPermissionName(PermissionCode.SUPPORT_ACCESS_APPROVE);
export const SUPPORT_EMERGENCY_MANAGE_PERMISSION = getPermissionName(PermissionCode.SUPPORT_EMERGENCY_MANAGE);
export const SUPPORT_SETTINGS_EDIT_PERMISSION = getPermissionName(PermissionCode.SUPPORT_SETTINGS_EDIT);
