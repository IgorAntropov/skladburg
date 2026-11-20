export const STAFF_CHANNEL_PREFIX = 'staff';
export const STAFF_PROFILES_CHANNEL_PREFIX = 'staffprofiles';

export const staffChannel = (warehouseId: string): string => `${STAFF_CHANNEL_PREFIX}:${warehouseId}`;

export const staffProfilesChannel = (warehouseId: string): string => `${STAFF_PROFILES_CHANNEL_PREFIX}:${warehouseId}`;
